import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { GET, POST } from "./route";

const suffix = randomUUID();
const userId = `quotation-api-user-${suffix}`;
const orgAId = `quotation-api-org-a-${suffix}`;
const orgBId = `quotation-api-org-b-${suffix}`;
let clientAId = "";
let clientBId = "";

function request(organizationId: string, method = "GET", payload?: unknown) {
  return new Request(`http://localhost/api/organizations/${organizationId}/quotations`, {
    method,
    ...(method === "POST" ? {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    } : {}),
  }) as never;
}
function get(organizationId: string) {
  return GET(request(organizationId), { params: Promise.resolve({ organizationId }) });
}
function post(organizationId: string, payload: unknown) {
  return POST(request(organizationId, "POST", payload), { params: Promise.resolve({ organizationId }) });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${suffix}@quotation-api-test.invalid` } });
  await prisma.organization.createMany({
    data: [
      { id: orgAId, name: "Quotation Tenant A", slug: `quotation-a-${suffix}` },
      { id: orgBId, name: "Quotation Tenant B", slug: `quotation-b-${suffix}` },
    ],
  });
  await prisma.membership.create({ data: { userId, organizationId: orgAId, role: "OWNER" } });
  const [clientA, clientB] = await Promise.all([
    prisma.client.create({ data: { organizationId: orgAId, name: "Quotation Client A" } }),
    prisma.client.create({ data: { organizationId: orgBId, name: "Quotation Client B" } }),
  ]);
  clientAId = clientA.id;
  clientBId = clientB.id;
  await prisma.quotation.create({
    data: {
      organizationId: orgBId, clientId: clientBId, number: `QT-OTHER-${suffix.slice(0, 8)}`,
      subtotal: 100, discount: 0, tax: 0, total: 100,
    },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("quotation API with real PostgreSQL tenant boundaries", () => {
  it("lists only quotations for the authenticated organization", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await get(orgAId);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.quotations).toHaveLength(0);
  });

  it("creates quotation header, line items and audit log atomically", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await post(orgAId, {
      clientId: clientAId,
      items: [
        { description: "Property management service", quantity: 2, unitPrice: 1500000 },
        { description: "Initial inspection", quantity: 1, unitPrice: 500000 },
      ],
      discount: 100000,
      tax: 200000,
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.quotation).toMatchObject({
      organizationId: orgAId, clientId: clientAId, status: "DRAFT",
      subtotal: "3500000", discount: "100000", tax: "200000", total: "3600000",
    });
    expect(payload.quotation.items).toHaveLength(2);
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: orgAId, entityType: "Quotation", entityId: payload.quotation.id, action: "quotation.created" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a Client reference belonging to another organization", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await post(orgAId, {
      clientId: clientBId,
      items: [{ description: "Cross-tenant attempt", quantity: 1, unitPrice: 100 }],
    });
    expect(response.status).toBe(404);
    expect(await prisma.quotation.count({ where: { organizationId: orgAId } })).toBe(1);
  });

  it("denies cross-tenant reads and unauthenticated access", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    expect((await get(orgBId)).status).toBe(403);
    getServerSession.mockResolvedValue({ user: {} });
    expect((await get(orgAId)).status).toBe(401);
  });
});
