import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole, TestDecimal } = vi.hoisted(() => {
  class TestDecimal {
    value: number;
    constructor(value: number | string | TestDecimal) { this.value = value instanceof TestDecimal ? value.value : Number(value); }
    mul(value: number | string | TestDecimal) { return new TestDecimal(this.value * Number(value instanceof TestDecimal ? value.value : value)); }
    plus(value: number | string | TestDecimal) { return new TestDecimal(this.value + Number(value instanceof TestDecimal ? value.value : value)); }
    minus(value: number | string | TestDecimal) { return new TestDecimal(this.value - Number(value instanceof TestDecimal ? value.value : value)); }
    toDecimalPlaces(dp: number) { const factor = 10 ** dp; return new TestDecimal(Math.round((this.value + Number.EPSILON) * factor) / factor); }
    greaterThan(value: number | string) { return this.value > Number(value); }
    lessThan(value: number | string) { return this.value < Number(value); }
    toString() { return this.value.toFixed(2); }
  }
  return {
    prisma: { quotation: { findFirst: vi.fn() }, $transaction: vi.fn() },
    requireTenantContext: vi.fn(),
    requireTenantRole: vi.fn(),
    TestDecimal,
  };
});
vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER", SALES: "SALES" },
  Prisma: { Decimal: TestDecimal, TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@/lib/tenant", () => ({
  requireTenantContext, requireTenantRole,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));
import { GET, PATCH } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a", quotationId: "quotation-a" }) };
const getRequest = () => new Request("http://localhost/api/organizations/org-a/quotations/quotation-a") as never;
const patchRequest = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/quotations/quotation-a", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
}) as never;

describe("quotation detail API", () => {
  beforeEach(() => {
    prisma.quotation.findFirst.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("returns a quotation scoped to the authorized organization", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a" });
    prisma.quotation.findFirst.mockResolvedValue({ id: "quotation-a", organizationId: "org-a", items: [] });
    const response = await GET(getRequest(), context);
    expect(response.status).toBe(200);
    expect(prisma.quotation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", id: "quotation-a" },
    }));
  });

  it("sends a draft quotation and records an audit event atomically", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a" });
    const current = { id: "quotation-a", organizationId: "org-a", status: "DRAFT", number: "QT-1", total: new TestDecimal(100), items: [] };
    const sent = { ...current, status: "SENT", issuedAt: new Date(), client: null, project: null, items: [] };
    const tx = {
      quotation: {
        findFirst: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(sent),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await PATCH(patchRequest({ action: "send" }), context);
    expect(response.status).toBe(200);
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", id: "quotation-a", status: "DRAFT" },
      data: expect.objectContaining({ status: "SENT", issuedAt: expect.any(Date) }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "quotation.sent", organizationId: "org-a", actorId: "sales-a" }),
    }));
  });

  it("rejects editing a quotation that is no longer a draft", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a" });
    const tx = {
      quotation: { findFirst: vi.fn().mockResolvedValue({ id: "quotation-a", status: "SENT", items: [] }), updateMany: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await PATCH(patchRequest({ action: "send" }), context);
    expect(response.status).toBe(409);
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid action payloads", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a" });
    const response = await PATCH(patchRequest({ action: "delete" }), context);
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
