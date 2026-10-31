import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext, requireTenantRole } = vi.hoisted(() => ({
  prisma: {
    project: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTenantContext: vi.fn(),
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER" },
  ProjectStatus: { DRAFT: "DRAFT", IN_PROGRESS: "IN_PROGRESS" },
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

const context = (organizationId = "org-a") => ({ params: Promise.resolve({ organizationId }) });
const body = (overrides: Record<string, unknown> = {}) => ({
  clientId: "client-a",
  code: "PRJ-001",
  name: "Renovasi Rumah",
  contractValue: 125000000,
  ...overrides,
});
const request = (payload: unknown) => new Request("http://localhost/api/organizations/org-a/projects", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
}) as never;

function setupTransaction(options: {
  client?: { id: string } | null;
  subscription?: { plan: { maxProjects: number | null } } | null;
  projectCount?: number;
} = {}) {
  const tx = {
    client: { findUnique: vi.fn().mockResolvedValue(options.client === undefined ? { id: "client-a" } : options.client) },
    subscription: { findFirst: vi.fn().mockResolvedValue(options.subscription === undefined ? { plan: { maxProjects: 10 } } : options.subscription) },
    project: {
      count: vi.fn().mockResolvedValue(options.projectCount ?? 1),
      create: vi.fn().mockResolvedValue({ id: "project-a", organizationId: "org-a", clientId: "client-a", code: "PRJ-001", name: "Renovasi Rumah", status: "DRAFT", progress: 0, client: { id: "client-a", name: "Client A" } }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
  };
  prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("organization projects API tenant boundary and quotas", () => {
  beforeEach(() => {
    prisma.project.findMany.mockReset();
    prisma.$transaction.mockReset();
    requireTenantContext.mockReset();
    requireTenantRole.mockReset();
  });

  it("lists only projects belonging to the authorized organization", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    prisma.project.findMany.mockResolvedValue([{ id: "project-a", organizationId: "org-a" }]);
    const response = await GET(new Request("http://localhost/api/organizations/org-a/projects") as never, context());
    expect(response.status).toBe(200);
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a" },
      take: 50,
    }));
  });

  it("does not query projects if the caller is not a member of the tenant", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await GET(new Request("http://localhost/api/organizations/org-b/projects") as never, context("org-b"));
    expect(response.status).toBe(403);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it("creates a project and audit entry atomically for an authorized project manager", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "manager-a", role: "PROJECT_MANAGER" });
    const tx = setupTransaction();
    const response = await POST(request(body()), context());
    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.client.findUnique).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId: "org-a", id: "client-a" } },
      select: { id: true },
    });
    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", clientId: "client-a", code: "PRJ-001", progress: 0 }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "manager-a", action: "project.created" }),
    }));
  });

  it("rejects a client belonging to another organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setupTransaction({ client: null });
    const response = await POST(request(body()), context());
    expect(response.status).toBe(404);
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it("requires an active subscription before project creation", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setupTransaction({ subscription: null });
    const response = await POST(request(body()), context());
    expect(response.status).toBe(402);
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it("enforces maxProjects inside the serializable transaction", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setupTransaction({ subscription: { plan: { maxProjects: 2 } }, projectCount: 2 });
    const response = await POST(request(body()), context());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ limit: 2, current: 2 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it("allows unlimited projects when maxProjects is null", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const tx = setupTransaction({ subscription: { plan: { maxProjects: null }, }, projectCount: 1000 });
    const response = await POST(request(body()), context());
    expect(response.status).toBe(201);
    expect(tx.project.create).toHaveBeenCalledTimes(1);
  });

  it("validates payload and rejects invalid date ranges", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const response = await POST(request(body({ startAt: "2026-11-02T00:00:00.000Z", dueAt: "2026-11-01T00:00:00.000Z" })), context());
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
