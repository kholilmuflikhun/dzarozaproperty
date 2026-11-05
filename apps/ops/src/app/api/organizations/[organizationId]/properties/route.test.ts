import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole } = vi.hoisted(() => ({
  prisma: { property: { findMany: vi.fn() }, $transaction: vi.fn() },
  requireTenantContext: vi.fn(),
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER" },
  PropertyType: { RESIDENTIAL: "RESIDENTIAL", APARTMENT: "APARTMENT", COMMERCIAL: "COMMERCIAL", INDUSTRIAL: "INDUSTRIAL", MIXED_USE: "MIXED_USE", LAND: "LAND", OTHER: "OTHER" },
  PropertyStatus: { DRAFT: "DRAFT", ACTIVE: "ACTIVE", INACTIVE: "INACTIVE", ARCHIVED: "ARCHIVED" },
  Prisma: {
    Decimal: class Decimal { constructor(public value: number) {} },
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
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
const request = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/properties", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
}) as never;
const payload = (overrides: Record<string, unknown> = {}) => ({
  code: "PROP-001", name: "Perumahan Harmoni", propertyType: "RESIDENTIAL",
  city: "Banyumas", latitude: -7.4, longitude: 109.2, landArea: 12000, ...overrides,
});

describe("organization property portfolio API", () => {
  beforeEach(() => {
    prisma.property.findMany.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("lists tenant-scoped properties with summary counts", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.property.findMany.mockResolvedValue([{ id: "property-a", organizationId: "org-a", _count: { buildings: 2, units: 40, assets: 10 } }]);
    const response = await GET(new Request("http://localhost/api/organizations/org-a/properties?city=Banyumas&limit=25") as never, context);
    expect(response.status).toBe(200);
    expect(prisma.property.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", city: "Banyumas" }, take: 25,
    }));
  });

  it("does not query property data when tenant authorization fails", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await GET(new Request("http://localhost/api/organizations/org-a/properties") as never, context);
    expect(response.status).toBe(403);
    expect(prisma.property.findMany).not.toHaveBeenCalled();
  });

  it("creates property and audit event atomically for an authorized manager", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "manager-a", role: "PROJECT_MANAGER" });
    const tx = {
      property: { create: vi.fn().mockResolvedValue({ id: "property-a", code: "PROP-001", name: "Perumahan Harmoni", propertyType: "RESIDENTIAL", status: "DRAFT" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(request(payload()), context);
    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.property.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", code: "PROP-001", name: "Perumahan Harmoni" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "manager-a", action: "property.created" }),
    }));
  });

  it("rejects invalid coordinates and does not write", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const response = await POST(request(payload({ latitude: 120 })), context);
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects roles without property management permission", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await POST(request(payload()), context);
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
