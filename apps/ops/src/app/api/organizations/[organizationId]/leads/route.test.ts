import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole } = vi.hoisted(() => ({
  prisma: {
    lead: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTenantContext: vi.fn(),
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER", SALES: "SALES" },
  Prisma: {
    Decimal: class Decimal { constructor(public value: number) {} },
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));
vi.mock("@/lib/tenant", () => ({
  requireTenantContext,
  requireTenantRole,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a" }) };
const postRequest = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/leads", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
}) as never;
const getRequest = (query = "") => new Request(`http://localhost/api/organizations/org-a/leads${query}`) as never;

describe("organization CRM leads API", () => {
  beforeEach(() => {
    prisma.lead.findMany.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("lists only leads belonging to the authorized organization", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.lead.findMany.mockResolvedValue([{ id: "lead-a", organizationId: "org-a" }]);
    const response = await GET(getRequest(), context);
    expect(response.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a" },
      take: 51,
    }));
  });

  it("filters by a validated pipeline stage and supports bounded page sizes", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.lead.findMany.mockResolvedValue([]);
    const response = await GET(getRequest("?stage=QUALIFIED&limit=20"), context);
    expect(response.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", stage: "QUALIFIED" },
      take: 21,
    }));
  });

  it("rejects invalid filters before querying", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    const response = await GET(getRequest("?stage=UNKNOWN&limit=500"), context);
    expect(response.status).toBe(400);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it("does not query leads when tenant authorization fails", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await GET(getRequest(), context);
    expect(response.status).toBe(403);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it("creates a lead and audit log atomically", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const tx = {
      client: { findUnique: vi.fn().mockResolvedValue({ id: "client-a" }) },
      lead: { create: vi.fn().mockResolvedValue({
        id: "lead-a", organizationId: "org-a", title: "Renovasi kantor",
        contactName: "Budi", clientId: "client-a", stage: "NEW",
      }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(postRequest({
      title: " Renovasi kantor ", contactName: " Budi ", clientId: "client-a",
      email: "BUDI@EXAMPLE.COM", phone: "", estimatedValue: 125000000,
    }), context);
    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.client.findUnique).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId: "org-a", id: "client-a" } },
      select: { id: true },
    });
    expect(tx.lead.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-a", title: "Renovasi kantor", contactName: "Budi",
        email: "budi@example.com", stage: "NEW",
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "sales-a", action: "lead.created" }),
    }));
  });

  it("rejects a client belonging to another organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const tx = {
      client: { findUnique: vi.fn().mockResolvedValue(null) },
      lead: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(postRequest({
      title: "Renovasi kantor", contactName: "Budi", clientId: "client-from-org-b",
    }), context);
    expect(response.status).toBe(404);
    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects invalid input and unauthorized roles without writing", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const invalid = await POST(postRequest({ title: "x", contactName: "B" }), context);
    expect(invalid.status).toBe(400);
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const forbidden = await POST(postRequest({ title: "Lead baru", contactName: "Budi" }), context);
    expect(forbidden.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
