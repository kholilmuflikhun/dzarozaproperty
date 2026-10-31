import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, getServerSession } = vi.hoisted(() => ({
  prisma: {
    plan: { findUnique: vi.fn(), upsert: vi.fn() },
    platformAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSession: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  Prisma: {
    Decimal: class Decimal {
      private readonly value: number;
      constructor(value: number) { this.value = value; }
      toString() { return String(this.value); }
    },
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "./route";

const payload = {
  code: "PRO",
  name: "Professional",
  description: "Plan description",
  monthlyPrice: 150000,
  yearlyPrice: 1500000,
  currency: "IDR",
  maxUsers: 10,
  maxProjects: 20,
  maxStorageMb: 1024,
  maxActivations: 3,
  featureFlags: { crm: true, finance: true },
};

function request(body: unknown = payload) {
  return new Request("http://localhost/api/platform/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function setupTransaction() {
  const tx = {
    plan: { findUnique: prisma.plan.findUnique, upsert: prisma.plan.upsert },
    platformAuditLog: { create: prisma.platformAuditLog.create },
  };
  prisma.$transaction.mockImplementation(async (
    callback: (client: typeof tx) => Promise<unknown>,
    options: unknown,
  ) => {
    await callback(tx);
    return prisma.plan.upsert.mock.results.at(-1)?.value;
  });
  return { tx };
}

describe("platform plan administration", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    prisma.plan.findUnique.mockReset();
    prisma.plan.upsert.mockReset();
    prisma.platformAuditLog.create.mockReset();
    prisma.$transaction.mockReset();
  });

  it("rejects non-admin requests without opening a transaction", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a", isPlatformAdmin: false } });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid plan data before opening a transaction", async () => {
    getServerSession.mockResolvedValue({ user: { id: "admin-a", isPlatformAdmin: true } });

    const response = await POST(request({ ...payload, monthlyPrice: -1 }));

    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records a complete created snapshot in the same serializable transaction", async () => {
    getServerSession.mockResolvedValue({ user: { id: "admin-a", isPlatformAdmin: true } });
    const saved = {
      id: "plan-a", ...payload, isActive: true,
      monthlyPrice: { toString: () => "150000" },
      yearlyPrice: { toString: () => "1500000" },
    };
    prisma.plan.findUnique.mockResolvedValue(null);
    prisma.plan.upsert.mockResolvedValue(saved);
    const tx = setupTransaction();

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.tx.plan.findUnique).toHaveBeenCalledWith({ where: { code: "PRO" } });
    expect(tx.tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-a",
        action: "plan.created",
        entityType: "Plan",
        entityId: "plan-a",
        beforeState: undefined,
        afterState: expect.objectContaining({
          code: "PRO", name: "Professional", description: "Plan description",
          monthlyPrice: "150000", yearlyPrice: "1500000", currency: "IDR",
          maxUsers: 10, maxProjects: 20, maxStorageMb: 1024, maxActivations: 3,
          featureFlags: { crm: true, finance: true }, isActive: true,
        }),
      }),
    });
  });

  it("records the actual before and after snapshots when updating an existing plan", async () => {
    getServerSession.mockResolvedValue({ user: { id: "admin-a", isPlatformAdmin: true } });
    const existing = {
      id: "plan-a", code: "PRO", name: "Old name", description: "Old description",
      monthlyPrice: { toString: () => "100000" }, yearlyPrice: { toString: () => "1000000" },
      currency: "IDR", maxUsers: 5, maxProjects: 10, maxStorageMb: 512,
      maxActivations: 2, featureFlags: { crm: false }, isActive: true,
    };
    const saved = {
      ...existing, ...payload, name: "Professional", isActive: true,
      monthlyPrice: { toString: () => "150000" },
      yearlyPrice: { toString: () => "1500000" },
    };
    prisma.plan.findUnique.mockResolvedValue(existing);
    prisma.plan.upsert.mockResolvedValue(saved);
    const tx = setupTransaction();

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(tx.tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "plan.updated",
        beforeState: expect.objectContaining({
          name: "Old name", description: "Old description",
          monthlyPrice: "100000", yearlyPrice: "1000000",
          maxUsers: 5, maxProjects: 10, maxStorageMb: 512,
          maxActivations: 2, featureFlags: { crm: false }, isActive: true,
        }),
        afterState: expect.objectContaining({
          name: "Professional", monthlyPrice: "150000", yearlyPrice: "1500000",
          maxUsers: 10, maxProjects: 20, maxStorageMb: 1024,
          featureFlags: { crm: true, finance: true },
        }),
      }),
    });
  });

  it("returns a safe error and relies on transaction rollback when audit persistence fails", async () => {
    getServerSession.mockResolvedValue({ user: { id: "admin-a", isPlatformAdmin: true } });
    prisma.plan.findUnique.mockResolvedValue(null);
    prisma.plan.upsert.mockResolvedValue({
      id: "plan-a", ...payload, isActive: true,
      monthlyPrice: { toString: () => "150000" },
      yearlyPrice: { toString: () => "1500000" },
    });
    prisma.platformAuditLog.create.mockRejectedValue(new Error("audit unavailable"));
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      await callback({
        plan: prisma.plan,
        platformAuditLog: prisma.platformAuditLog,
      });
    });

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Paket gagal disimpan. Silakan coba kembali." });
    expect(prisma.plan.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.platformAuditLog.create).toHaveBeenCalledTimes(1);
  });
});
