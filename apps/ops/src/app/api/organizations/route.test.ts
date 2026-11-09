import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireUserId } = vi.hoisted(() => ({
  prisma: {
    membership: { findMany: vi.fn() },
    organization: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  requireUserId: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER" },
}));
vi.mock("@/lib/tenant", () => ({
  requireUserId,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));

import { GET, POST } from "./route";

describe("organizations API authentication and ownership", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    prisma.membership.findMany.mockReset();
    prisma.organization.create.mockReset();
    prisma.auditLog.create.mockReset();
    prisma.$transaction.mockReset();
  });

  it("rejects organization listing without a session and performs no membership query", async () => {
    requireUserId.mockRejectedValue(Object.assign(new Error("Unauthenticated"), { name: "UnauthorizedError" }));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  it("lists only organizations linked to the authenticated user's memberships", async () => {
    requireUserId.mockResolvedValue("user-a");
    const memberships = [{
      role: "OWNER",
      organization: { id: "org-a", name: "Organization A", slug: "organization-a", currency: "IDR", timezone: "Asia/Jakarta" },
    }];
    prisma.membership.findMany.mockResolvedValue(memberships);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(prisma.membership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-a" },
      include: { organization: { select: { id: true, name: true, slug: true, currency: true, timezone: true } } },
    }));
    await expect(response.json()).resolves.toEqual({
      organizations: [{ ...memberships[0].organization, role: "OWNER" }],
    });
  });

  it("creates an organization, OWNER membership, and audit record in one transaction", async () => {
    requireUserId.mockResolvedValue("user-a");
    const created = { id: "org-a", name: "Dzaroza Property", slug: "dzaroza-property-12345678" };
    const tx = {
      organization: { create: vi.fn().mockResolvedValue(created) },
      membership: { create: vi.fn().mockResolvedValue({ id: "membership-a" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(new Request("http://localhost/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Dzaroza Property", legalName: "PT Dzaroza Property" }),
    }) as never);

    expect(response.status).toBe(201);
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Dzaroza Property", legalName: "PT Dzaroza Property" }),
    });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: { organizationId: "org-a", userId: "user-a", role: "OWNER" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        actorId: "user-a",
        action: "organization.created",
        entityId: "org-a",
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ organization: created });
  });

  it("returns an error when membership creation fails so the database transaction can roll back", async () => {
    requireUserId.mockResolvedValue("user-a");
    const tx = {
      organization: { create: vi.fn().mockResolvedValue({ id: "org-a" }) },
      membership: { create: vi.fn().mockRejectedValue(new Error("membership write failed")) },
      auditLog: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(new Request("http://localhost/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Dzaroza Property" }),
    }) as never);

    expect(response.status).toBe(500);
    expect(tx.organization.create).toHaveBeenCalledTimes(1);
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid organization input before opening a transaction", async () => {
    requireUserId.mockResolvedValue("user-a");

    const response = await POST(new Request("http://localhost/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    }) as never);

    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
