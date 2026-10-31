import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { POST as convertQuotation } from "../quotations/[quotationId]/convert/route";
import { POST as createApprovalLink } from "../quotations/[quotationId]/approval-link/route";
import { POST as createInvoice } from "../invoices/route";
import { GET as invoicePdf } from "../invoices/[invoiceId]/pdf/route";
import { PATCH as updateInvoice } from "../invoices/[invoiceId]/route";
import { POST as recordPayment } from "../payments/route";
import { GET as financeSummary } from "./summary/route";
import { GET as publicApprovalGet, POST as publicApprovalPost } from "../../../public/quotation-approvals/[token]/route";
import { POST as midtransWebhook } from "../../../webhooks/midtrans/route";

const suffix = randomUUID();
const userId = `phase2-user-${suffix}`;
const organizationId = `phase2-org-${suffix}`;
const clientId = `phase2-client-${suffix}`;
const planCode = `P2-${suffix.slice(0, 8)}`;
const secret = "phase2-midtrans-test-secret";
let quotationId = "";
let projectId = "";
let invoiceId = "";

const orgContext = { params: Promise.resolve({ organizationId }) };
const request = (url: string, method = "GET", body?: unknown) => new NextRequest(url, {
  method,
  headers: { "content-type": "application/json", "x-real-ip": "198.51.100.77" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeAll(async () => {
  process.env.MIDTRANS_SERVER_KEY = secret;
  await prisma.user.create({ data: { id: userId, email: `${suffix}@phase2-test.invalid` } });
  await prisma.organization.create({ data: { id: organizationId, name: "Phase 2 Test Org", slug: `phase2-${suffix}` } });
  await prisma.membership.create({ data: { organizationId, userId, role: "OWNER" } });
  await prisma.client.create({ data: { id: clientId, organizationId, name: "Phase 2 Test Client", email: "client@example.invalid" } });
  await prisma.plan.create({
    data: { code: planCode, name: "Phase 2 Test", monthlyPrice: 100000, yearlyPrice: 1000000, currency: "IDR", maxProjects: 20, maxActivations: 1, featureFlags: {} },
  });
  await prisma.subscription.create({
    data: { organizationId, planId: (await prisma.plan.findUniqueOrThrow({ where: { code: planCode } })).id, billingCycle: "MONTHLY", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
  });
  const quotation = await prisma.quotation.create({
    data: {
      organizationId, clientId, number: `QT-P2-${suffix.slice(0, 8)}`, status: "ACCEPTED",
      subtotal: 1000000, discount: 0, tax: 0, total: 1000000,
      items: { create: [{ description: "Jasa konsultasi", quantity: 1, unitPrice: 1000000, lineTotal: 1000000, sortOrder: 0 }] },
    },
  });
  quotationId = quotation.id;
  getServerSession.mockResolvedValue({ user: { id: userId } });
});

afterAll(async () => {
  await prisma.billingEvent.deleteMany({ where: { subscription: { organizationId } } });
  await prisma.paymentTransaction.deleteMany({ where: { organizationId } });
  await prisma.license.deleteMany({ where: { organizationId } });
  await prisma.subscription.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.plan.deleteMany({ where: { code: planCode } });
  delete process.env.MIDTRANS_SERVER_KEY;
});

describe("Phase 2 PostgreSQL business workflow integration", () => {
  it("accepts a valid single-use quotation token and rejects replay", async () => {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.quotation.update({
      where: { organizationId_id: { organizationId, id: quotationId } },
      data: { status: "SENT", approvalTokenHash: tokenHash, approvalTokenExpiresAt: new Date(Date.now() + 60000), approvalTokenUsedAt: null },
    });
    const context = { params: Promise.resolve({ token: rawToken }) };
    const view = await publicApprovalGet(request(`http://localhost/api/public/quotation-approvals/${rawToken}`), context);
    expect(view.status).toBe(200);
    const decision = await publicApprovalPost(request(`http://localhost/api/public/quotation-approvals/${rawToken}`, "POST", { decision: "ACCEPTED" }), context);
    expect(decision.status).toBe(200);
    const replay = await publicApprovalPost(request(`http://localhost/api/public/quotation-approvals/${rawToken}`, "POST", { decision: "REJECTED" }), context);
    expect(replay.status).toBe(409);
  });

  it("rejects an expired approval token", async () => {
    const expiredQuote = await prisma.quotation.create({
      data: { organizationId, clientId, number: `QT-EXP-${suffix.slice(0, 8)}`, status: "SENT", subtotal: 1000, discount: 0, tax: 0, total: 1000 },
    });
    const rawToken = randomBytes(32).toString("base64url");
    await prisma.quotation.update({
      where: { organizationId_id: { organizationId, id: expiredQuote.id } },
      data: { approvalTokenHash: createHash("sha256").update(rawToken).digest("hex"), approvalTokenExpiresAt: new Date(Date.now() - 60_000) },
    });
    const response = await publicApprovalGet(request(`http://localhost/api/public/quotation-approvals/${rawToken}`), { params: Promise.resolve({ token: rawToken }) });
    expect(response.status).toBe(404);
  });

  it("converts an accepted quotation exactly once and enforces tenant ownership", async () => {
    const first = await convertQuotation(request(`http://localhost/api/organizations/${organizationId}/quotations/${quotationId}`, "POST"), { params: Promise.resolve({ organizationId, quotationId }) });
    expect(first.status).toBe(201);
    const firstPayload = await first.json();
    projectId = firstPayload.project.id;
    const second = await convertQuotation(request(`http://localhost/api/organizations/${organizationId}/quotations/${quotationId}`, "POST"), { params: Promise.resolve({ organizationId, quotationId }) });
    expect(second.status).toBe(200);
    expect((await second.json()).project.id).toBe(projectId);
    expect(await prisma.project.count({ where: { organizationId, clientId } })).toBe(1);
  });

  it("creates, issues, partially pays, rejects overpayment, fully pays, and renders an invoice PDF", async () => {
    const created = await createInvoice(request(`http://localhost/api/organizations/${organizationId}/invoices`, "POST", { quotationId }), orgContext);
    expect(created.status).toBe(201);
    const createdPayload = await created.json();
    invoiceId = createdPayload.invoice.id;
    expect(createdPayload.invoice.total.toString()).toBe("1000000");

    const issue = await updateInvoice(request("http://localhost/invoice", "PATCH", { action: "issue" }), { params: Promise.resolve({ organizationId, invoiceId }) });
    expect(issue.status).toBe(200);
    expect((await issue.json()).invoice.status).toBe("SENT");

    const partial = await recordPayment(request("http://localhost/payments", "POST", { invoiceId, amount: 400000 }), orgContext);
    expect(partial.status).toBe(201);
    expect((await partial.json()).invoice.status).toBe("PARTIALLY_PAID");

    const overpayment = await recordPayment(request("http://localhost/payments", "POST", { invoiceId, amount: 700000 }), orgContext);
    expect(overpayment.status).toBe(400);

    const finalPayment = await recordPayment(request("http://localhost/payments", "POST", { invoiceId, amount: 600000 }), orgContext);
    expect(finalPayment.status).toBe(201);
    expect((await finalPayment.json()).invoice.status).toBe("PAID");

    const pdf = await invoicePdf(request("http://localhost/invoice.pdf"), { params: Promise.resolve({ organizationId, invoiceId }) });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(500);

    const summary = await financeSummary(request(`http://localhost/api/organizations/${organizationId}/finance/summary`), orgContext);
    expect(summary.status).toBe(200);
    const data = await summary.json();
    expect(data.currentMonth.collected).toBe("1000000");
  });

  it("applies a signed Midtrans invoice settlement once to the invoice balance", async () => {
    const created = await createInvoice(request(`http://localhost/api/organizations/${organizationId}/invoices`, "POST", {
      projectId, items: [{ description: "Biaya tambahan", quantity: 1, unitPrice: 500000 }],
    }), orgContext);
    expect(created.status).toBe(201);
    const newInvoice = (await created.json()).invoice;
    const issued = await updateInvoice(request("http://localhost/invoice", "PATCH", { action: "issue" }), { params: Promise.resolve({ organizationId, invoiceId: newInvoice.id }) });
    expect(issued.status).toBe(200);
    const orderId = `MID-P2-${suffix.slice(0, 10)}`;
    await prisma.paymentTransaction.create({
      data: { organizationId, invoiceId: newInvoice.id, provider: "MIDTRANS", providerOrderId: orderId, amount: 500000, currency: "IDR", status: "PENDING" },
    });
    const payload = {
      order_id: orderId, status_code: "200", gross_amount: "500000.00",
      transaction_id: `TRX-P2-${suffix.slice(0, 10)}`, transaction_status: "settlement", currency: "IDR",
    };
    const signature_key = createHash("sha512").update(payload.order_id + payload.status_code + payload.gross_amount + secret).digest("hex");
    const webhook = await midtransWebhook(request("http://localhost/api/webhooks/midtrans", "POST", { ...payload, signature_key }));
    expect(webhook.status).toBe(200);
    const updated = await prisma.invoice.findFirstOrThrow({ where: { organizationId, id: newInvoice.id } });
    expect(updated.status).toBe("PAID");
    expect(updated.paidAmount.toString()).toBe("500000");
    const duplicate = await midtransWebhook(request("http://localhost/api/webhooks/midtrans", "POST", { ...payload, signature_key }));
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).duplicate).toBe(true);
    const unchanged = await prisma.invoice.findFirstOrThrow({ where: { organizationId, id: newInvoice.id } });
    expect(unchanged.paidAmount.toString()).toBe("500000");
  });
  it("issues an approval link for the verified client and supports one-time acceptance", async () => {
    process.env.NEXTAUTH_URL = "http://localhost:3001";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const quote = await prisma.quotation.create({
      data: { organizationId, clientId, number: `QT-LINK-${suffix.slice(0, 8)}`, status: "SENT", subtotal: 1000, discount: 0, tax: 0, total: 1000 },
    });
    const generated = await createApprovalLink(
      request(`http://localhost/api/organizations/${organizationId}/quotations/${quote.id}/approval-link`, "POST"),
      { params: Promise.resolve({ organizationId, quotationId: quote.id }) },
    );
    expect(generated.status).toBe(201);
    const result = await generated.json();
    expect(result.approval.delivery).toBe("manual");
    const token = new URL(result.approval.url).pathname.split("/").pop()!;
    const context = { params: Promise.resolve({ token }) };
    expect((await publicApprovalGet(request(result.approval.url), context)).status).toBe(200);
    expect((await publicApprovalPost(request(result.approval.url, "POST", { decision: "ACCEPTED" }), context)).status).toBe(200);
    expect((await publicApprovalPost(request(result.approval.url, "POST", { decision: "REJECTED" }), context)).status).toBe(409);
  });

});
