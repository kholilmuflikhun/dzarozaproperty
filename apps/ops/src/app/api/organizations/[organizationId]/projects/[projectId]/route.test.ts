import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole } = vi.hoisted(() => ({
  prisma: { project: { findFirst: vi.fn() }, $transaction: vi.fn() },
  requireTenantContext: vi.fn(),
  requireTenantRole: vi.fn(),
}));
vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER" },
  ProjectStatus: { ARCHIVED: "ARCHIVED", IN_PROGRESS: "IN_PROGRESS" },
  Prisma: {
    Decimal: class Decimal { constructor(public value: number) {} },
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));
vi.mock("@/lib/tenant", () => ({
  requireTenantContext, requireTenantRole,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    return name === "UnauthorizedError" ? { status: 401, message: "Autentikasi diperlukan." } :
      name === "ForbiddenError" ? { status: 403, message: "Akses ditolak." } :
      { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));
import { DELETE, GET, PATCH } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a", projectId: "project-a" }) };
const request = (body: unknown) => new Request("http://localhost/api/organizations/org-a/projects/project-a", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}) as never;

function setup(current: Record<string, unknown> | null = {
  id: "project-a", organizationId: "org-a", clientId: "client-a", code: "P-1", name: "Project",
  status: "IN_PROGRESS", progress: 20, startAt: new Date("2026-10-01"), dueAt: new Date("2026-11-01"),
}) {
  const tx = {
    project: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    client: { findUnique: vi.fn().mockResolvedValue({ id: "client-b" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
  };
  prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("organization project detail API", () => {
  beforeEach(() => {
    prisma.project.findFirst.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("returns only a project in the authorized organization", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.project.findFirst.mockResolvedValue({ id: "project-a", organizationId: "org-a" });
    const response = await GET(new Request("http://localhost") as never, context);
    expect(response.status).toBe(200);
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-a", id: "project-a" } }));
  });

  it("returns 404 for a project outside the tenant", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.project.findFirst.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost") as never, context);
    expect(response.status).toBe(404);
  });

  it("updates project and audit entry in one transaction", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "manager-a", role: "PROJECT_MANAGER" });
    const tx = setup();
    tx.project.findFirst.mockResolvedValueOnce({
      id: "project-a", organizationId: "org-a", clientId: "client-a", code: "P-1", name: "Project",
      status: "IN_PROGRESS", progress: 20, startAt: new Date("2026-10-01"), dueAt: new Date("2026-11-01"),
    }).mockResolvedValueOnce({ id: "project-a", name: "Updated", client: { id: "client-a", name: "Client" } });
    const response = await PATCH(request({ name: "Updated", progress: 50 }), context);
    expect(response.status).toBe(200);
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", id: "project-a" }, data: { name: "Updated", progress: 50 },
    }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("rejects a client from another organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setup();
    tx.client.findUnique.mockResolvedValue(null);
    const response = await PATCH(request({ clientId: "client-b" }), context);
    expect(response.status).toBe(404);
    expect(tx.project.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a date range that conflicts with the stored start date", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setup();
    const response = await PATCH(request({ dueAt: "2026-09-01T00:00:00.000Z" }), context);
    expect(response.status).toBe(400);
    expect(tx.project.updateMany).not.toHaveBeenCalled();
  });

  it("archives rather than deleting a project and records the audit event", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setup();
    const response = await DELETE(new Request("http://localhost") as never, context);
    expect(response.status).toBe(200);
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", id: "project-a" }, data: { status: "ARCHIVED" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "project.archived", entityId: "project-a" }),
    }));
  });
});
