import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole } = vi.hoisted(() => ({
  prisma: { client: { findMany: vi.fn() }, $transaction: vi.fn() },
  requireTenantContext: vi.fn(),
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER", SALES: "SALES" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
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
const request = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/clients", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
}) as never;

describe("organization clients API tenant boundary", () => {
  beforeEach(() => {
    prisma.client.findMany.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("lists clients only after tenant authorization and scopes the query", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.client.findMany.mockResolvedValue([{ id: "client-a", organizationId: "org-a" }]);
    const response = await GET(new Request("http://localhost/api/organizations/org-a/clients") as never, context);
    expect(response.status).toBe(200);
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-a" } }));
  });

  it("does not query clients if the user is not a member of the requested tenant", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await GET(new Request("http://localhost/api/organizations/org-a/clients") as never, context);
    expect(response.status).toBe(403);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("creates a client and audit log atomically", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "sales-a", role: "SALES" });
    const tx = {
      client: { create: vi.fn().mockResolvedValue({ id: "client-a", organizationId: "org-a", name: "PT Contoh", email: "admin@example.com", phone: null }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(request({ name: " PT Contoh ", email: "ADMIN@EXAMPLE.COM", phone: "" }), context);
    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.client.create).toHaveBeenCalledWith({
      data: { organizationId: "org-a", name: "PT Contoh", email: "admin@example.com", phone: null },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "sales-a", action: "client.created" }),
    }));
  });

  it("rejects invalid client data before writing", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const response = await POST(request({ name: "A", email: "not-an-email" }), context);
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects callers without a permitted role", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await POST(request({ name: "PT Contoh" }), context);
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
