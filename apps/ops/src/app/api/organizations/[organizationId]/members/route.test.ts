import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantRole } = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  requireTenantRole: vi.fn(),
}));
vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@/lib/tenant", () => ({
  requireTenantRole,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));
import { POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a" }) };
const request = (body: unknown) => new Request("http://localhost/api/organizations/org-a/members", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}) as never;

type SetupOptions = {
  actorRole?: string;
  user?: { id: string; email: string; name: string | null } | null;
  existing?: { id: string } | null;
  subscription?: { plan: { maxUsers: number | null } } | null;
  memberCount?: number;
};

function setup({
  actorRole = "OWNER",
  user = { id: "user-b", email: "member@example.com", name: "Member" },
  existing = null,
  subscription = { plan: { maxUsers: 5 } },
  memberCount = 1,
}: SetupOptions = {}) {
  requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: actorRole });
  const tx = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    membership: {
      findUnique: vi.fn().mockResolvedValue(existing),
      count: vi.fn().mockResolvedValue(memberCount),
      create: vi.fn().mockResolvedValue({ id: "membership-b", role: "STAFF", user }),
    },
    subscription: { findFirst: vi.fn().mockResolvedValue(subscription) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-b" }) },
  };
  prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("organization member creation", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    prisma.$transaction.mockReset();
  });

  it("requires organization OWNER or ADMIN before opening a transaction", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows OWNER to add a registered user and writes an audit record atomically", async () => {
    const tx = setup();
    const response = await POST(request({ email: " MEMBER@EXAMPLE.COM ", role: "STAFF" }), context);
    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { email: "member@example.com" }, select: { id: true, email: true, name: true } });
    expect(tx.membership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { organizationId: "org-a", userId: "user-b", role: "STAFF" },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", actorId: "owner-a", action: "membership.created" }),
    }));
  });

  it("does not allow ADMIN to grant another ADMIN role", async () => {
    setup({ actorRole: "ADMIN" });
    const response = await POST(request({ email: "member@example.com", role: "ADMIN" }), context);
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unknown users without creating a membership", async () => {
    const tx = setup({ user: null });
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(404);
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate memberships", async () => {
    const tx = setup({ existing: { id: "membership-existing" } });
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(409);
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("requires an active paid or trial subscription", async () => {
    const tx = setup({ subscription: null });
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(402);
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("enforces the plan seat limit inside the serializable transaction", async () => {
    const tx = setup({ subscription: { plan: { maxUsers: 2 } }, memberCount: 2 });
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ limit: 2, current: 2 });
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("allows unlimited seats when maxUsers is null", async () => {
    const tx = setup({ subscription: { plan: { maxUsers: null } }, memberCount: 999 });
    const response = await POST(request({ email: "member@example.com", role: "STAFF" }), context);
    expect(response.status).toBe(201);
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized streamed request bodies", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "owner-a", role: "OWNER" });
    const response = await POST(new Request("http://localhost/api/organizations/org-a/members", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a".repeat(5000), role: "STAFF" }),
    }) as never, context);
    expect(response.status).toBe(413);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
