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
    prisma: { quotation: { findMany: vi.fn() }, $transaction: vi.fn() },
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
import { GET, POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a" }) };
const getRequest = (query = "") => new Request(`http://localhost/api/organizations/org-a/quotations${query}`) as never;
const postRequest = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/quotations", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
}) as never;

describe("organization quotations API", () => {
  beforeEach(() => {
    prisma.quotation.findMany.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("lists quotations within the authorized organization and filters by status", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.quotation.findMany.mockResolvedValue([]);
    const response = await GET(getRequest("?status=DRAFT&limit=25"), context);
    expect(response.status).toBe(200);
    expect(prisma.quotation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", status: "DRAFT" }, take: 26,
    }));
  });

  it("rejects invalid status and page size", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    const response = await GET(getRequest("?status=UNKNOWN&limit=500"), context);
    expect(response.status).toBe(400);
    expect(prisma.quotation.findMany).not.toHaveBeenCalled();
  });

  it("creates quotation items, calculates totals on the server, and writes audit atomically", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const quotation = {
      id: "quotation-a", organizationId: "org-a", number: "QT-TEST-001", clientId: "client-a",
      projectId: null, subtotal: "250.00", discount: "10.00", tax: "12.00", total: "252.00",
      items: [{ description: "Consultation", quantity: "2.000", unitPrice: "125.00", lineTotal: "250.00" }],
    };
    const tx = {
      client: { findUnique: vi.fn().mockResolvedValue({ id: "client-a" }) },
      project: { findUnique: vi.fn() },
      quotation: { create: vi.fn().mockResolvedValue(quotation) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(postRequest({
      clientId: "client-a", items: [{ description: "Consultation", quantity: 2, unitPrice: 125 }],
      discount: 10, tax: 12,
    }), context);
    expect(response.status).toBe(201);
    expect(tx.quotation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-a", status: "DRAFT",
        subtotal: expect.any(TestDecimal), discount: expect.any(TestDecimal),
        tax: expect.any(TestDecimal), total: expect.any(TestDecimal),
        items: { create: [expect.objectContaining({ description: "Consultation", sortOrder: 0 })] },
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "sales-a", action: "quotation.created" }),
    }));
  });

  it("rejects a discount greater than the server-calculated subtotal", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const response = await POST(postRequest({
      clientId: "client-a", items: [{ description: "Service", quantity: 1, unitPrice: 100 }], discount: 101,
    }), context);
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant client references and unauthorized roles", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const tx = {
      client: { findUnique: vi.fn().mockResolvedValue(null) },
      project: { findUnique: vi.fn() }, quotation: { create: vi.fn() }, auditLog: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const forbiddenClient = await POST(postRequest({
      clientId: "client-b", items: [{ description: "Service", quantity: 1, unitPrice: 100 }],
    }), context);
    expect(forbiddenClient.status).toBe(404);
    expect(tx.quotation.create).not.toHaveBeenCalled();

    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const forbiddenRole = await POST(postRequest({
      clientId: "client-a", items: [{ description: "Service", quantity: 1, unitPrice: 100 }],
    }), context);
    expect(forbiddenRole.status).toBe(403);
  });
});
