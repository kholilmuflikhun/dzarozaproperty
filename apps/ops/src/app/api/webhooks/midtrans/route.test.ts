import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prisma, PrismaClientKnownRequestError } = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(code: string, meta?: Record<string, unknown>) {
      super(code);
      this.code = code;
      this.meta = meta;
    }
  }
  return {
    prisma: { subscription: { findUnique: vi.fn() }, $transaction: vi.fn() },
    PrismaClientKnownRequestError,
  };
});

vi.mock("@dzaroza/database", () => {
  class Decimal {
    value: string;
    constructor(value: string) { this.value = String(value); }
    equals(other: unknown) { return Number(this.value) === Number(other); }
  }
  return { prisma, Prisma: { Decimal, PrismaClientKnownRequestError } };
});

import { POST } from "./route";

const serverKey = "midtrans-test-server-key";
const subscription = {
  id: "sub-a", organizationId: "org-a", status: "INCOMPLETE",
  billingCycle: "MONTHLY", checkoutAmount: "100000",
  plan: { monthlyPrice: "100000", yearlyPrice: "1000000" },
};

function makePayload(overrides: Record<string, string> = {}) {
  const payload = {
    order_id: "order-a", status_code: "200", gross_amount: "100000.00",
    transaction_id: "transaction-a", transaction_status: "settlement", currency: "IDR",
    ...overrides,
  };
  const signature_key = createHash("sha512")
    .update(payload.order_id + payload.status_code + payload.gross_amount + serverKey)
    .digest("hex");
  return { ...payload, signature_key };
}

function makeRequest(payload: Record<string, string>) {
  return new NextRequest("http://localhost/api/webhooks/midtrans", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    billingEvent: { create: vi.fn().mockResolvedValue({ id: "event-a" }) },
    paymentTransaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "payment-a" }),
      update: vi.fn().mockResolvedValue({ id: "payment-a" }),
    },
    subscription: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    license: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    ...overrides,
  };
}

describe("Midtrans webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = serverKey;
    prisma.subscription.findUnique.mockResolvedValue(subscription);
  });

  it("returns 503 when the server key is not configured", async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(503);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body even when Content-Length is absent", async () => {
    const oversized = " ".repeat(16_385);
    const request = new NextRequest("http://localhost/api/webhooks/midtrans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without looking up an order", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/midtrans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid-json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before looking up an order", async () => {
    const response = await POST(makeRequest({ ...makePayload(), signature_key: "0".repeat(128) }));
    expect(response.status).toBe(401);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown order", async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(404);
  });

  it("rejects a payment amount that differs from the subscribed plan", async () => {
    const response = await POST(makeRequest(makePayload({ gross_amount: "99000.00" })));
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("validates against the checkout snapshot even after the plan price changes", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      ...subscription,
      plan: { monthlyPrice: "125000", yearlyPrice: "1250000" },
    });
    const tx = makeTx();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("records settlement and activates the subscription and its licenses", async () => {
    const tx = makeTx();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(200);
    expect(tx.billingEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subscriptionId: "sub-a", provider: "MIDTRANS", providerEventId: "order-a:transaction-a:settlement:none" }),
    }));
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", subscriptionId: "sub-a", providerRef: "transaction-a", status: "SETTLEMENT", currency: "IDR", paidAt: expect.any(Date) }),
    }));
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sub-a", status: { in: ["INCOMPLETE", "PAST_DUE", "ACTIVE"] } },
      data: expect.objectContaining({ status: "ACTIVE", currentPeriodEnd: expect.any(Date) }),
    }));
    expect(tx.license.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { subscriptionId: "sub-a", status: "ACTIVE" }, data: { expiresAt: expect.any(Date) },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("returns an idempotent duplicate response for an existing event key", async () => {
    const tx = makeTx();
    tx.billingEvent.create.mockRejectedValue(new PrismaClientKnownRequestError("P2002", { target: ["providerEventId"] }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("does not acknowledge a payment-reference uniqueness conflict as a duplicate webhook event", async () => {
    const tx = makeTx({
      paymentTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new PrismaClientKnownRequestError("P2002", { target: ["providerRef"] })),
        update: vi.fn(),
      },
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Webhook belum dapat diproses." });
  });

  it("rejects a transaction reference owned by another subscription", async () => {
    const tx = makeTx({
      paymentTransaction: {
        findUnique: vi.fn().mockResolvedValue({ id: "payment-other", subscriptionId: "sub-other", organizationId: "org-other", status: "PENDING" }),
        create: vi.fn(), update: vi.fn(),
      },
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(409);
    expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
  });

  it("activates the subscription for a capture explicitly accepted by Midtrans", async () => {
    const tx = makeTx();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload({
      transaction_status: "capture",
      fraud_status: "accept",
    })));
    expect(response.status).toBe(200);
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CAPTURE", paidAt: expect.any(Date) }),
    }));
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("does not extend an already paid period when the same transaction advances from capture to settlement", async () => {
    const paidAt = new Date("2026-10-30T00:00:00.000Z");
    const tx = makeTx({
      paymentTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-a", subscriptionId: "sub-a", organizationId: "org-a",
          status: "CAPTURE", paidAt,
        }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "payment-a" }),
      },
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(makeRequest(makePayload({ transaction_status: "settlement" })));

    expect(response.status).toBe(200);
    expect(tx.paymentTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-a" },
      data: expect.objectContaining({ status: "SETTLEMENT", paidAt }),
    }));
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
    expect(tx.license.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("expires an incomplete subscription and revokes active licenses on terminal payment failure", async () => {
    const tx = makeTx();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload({ transaction_status: "expire" })));
    expect(response.status).toBe(200);
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: "sub-a", status: "INCOMPLETE" },
      data: { status: "EXPIRED" },
    });
    expect(tx.license.updateMany).toHaveBeenCalledWith({
      where: { subscriptionId: "sub-a", status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "subscription.payment_failed", entityId: "sub-a" }),
    }));
  });

  it("does not revoke licenses when a late terminal notification arrives for an active subscription", async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...subscription, status: "ACTIVE" });
    const tx = makeTx({
      subscription: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(makeRequest(makePayload({ transaction_status: "expire" })));

    expect(response.status).toBe(200);
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: "sub-a", status: "INCOMPLETE" },
      data: { status: "EXPIRED" },
    });
    expect(tx.license.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects notifications for a subscription already closed before opening a transaction", async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...subscription, status: "EXPIRED" });
    const response = await POST(makeRequest(makePayload()));
    expect(response.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("stores a challenged capture without activating the subscription", async () => {
    const tx = makeTx();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(makeRequest(makePayload({ transaction_status: "capture", fraud_status: "challenge" })));
    expect(response.status).toBe(200);
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CAPTURE_CHALLENGE", paidAt: null }),
    }));
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
