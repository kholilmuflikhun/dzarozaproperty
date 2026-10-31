import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, getServerSession } = vi.hoisted(() => ({
  prisma: { membership: { findUnique: vi.fn() } },
  getServerSession: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", STAFF: "STAFF" },
}));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import {
  requireUserId,
  requireTenantContext,
  requireTenantRole,
  toHttpError,
} from "./tenant";
import { ForbiddenError, UnauthorizedError } from "./errors";

describe("tenant authorization boundary", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    prisma.membership.findUnique.mockReset();
  });

  it("requires an authenticated session with a user id", async () => {
    getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    await expect(requireUserId()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  it("looks up membership using both organization and authenticated user identifiers", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    prisma.membership.findUnique.mockResolvedValue({
      organizationId: "org-a", userId: "user-a", role: "OWNER",
    });

    await expect(requireTenantContext("org-a")).resolves.toEqual({
      organizationId: "org-a", userId: "user-a", role: "OWNER",
    });
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: "org-a", userId: "user-a" } },
      select: { organizationId: true, userId: true, role: true },
    });
  });

  it("denies access when the requested organization has no membership", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    prisma.membership.findUnique.mockResolvedValue(null);

    await expect(requireTenantContext("org-b")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("defensively rejects a membership result whose tenant or user does not match", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    prisma.membership.findUnique.mockResolvedValue({
      organizationId: "org-b", userId: "user-a", role: "OWNER",
    });

    await expect(requireTenantContext("org-a")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("enforces the allowed role list after membership verification", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    prisma.membership.findUnique.mockResolvedValue({
      organizationId: "org-a", userId: "user-a", role: "STAFF",
    });

    await expect(requireTenantRole("org-a", ["OWNER", "ADMIN"])).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.membership.findUnique).toHaveBeenCalledOnce();
  });

  it("returns the verified membership for an allowed role", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    const membership = { organizationId: "org-a", userId: "user-a", role: "ADMIN" };
    prisma.membership.findUnique.mockResolvedValue(membership);

    await expect(requireTenantRole("org-a", ["OWNER", "ADMIN"])).resolves.toEqual(membership);
  });

  it("maps authentication and authorization errors to safe HTTP statuses", () => {
    expect(toHttpError(new UnauthorizedError())).toEqual({
      status: 401, message: "Autentikasi diperlukan.",
    });
    expect(toHttpError(new ForbiddenError())).toEqual({
      status: 403, message: "Akses ke organisasi atau tindakan ini tidak diizinkan.",
    });
    expect(toHttpError(new Error("database secret"))).toEqual({
      status: 500, message: "Terjadi kesalahan pada server.",
    });
  });
});
