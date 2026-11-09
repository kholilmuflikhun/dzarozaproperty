import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantRole } = vi.hoisted(() => ({
  prisma: { license: { findMany: vi.fn() } },
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", STAFF: "STAFF" },
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

import { GET } from "./route";

const context = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });

describe("GET organization licenses API tenant boundary", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    prisma.license.findMany.mockReset();
  });

  it("rejects a member whose role is not allowed before reading licenses", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));

    const response = await GET(new Request("http://localhost/api/organizations/org-a/licenses"), context("org-a"));

    expect(response.status).toBe(403);
    expect(requireTenantRole).toHaveBeenCalledWith("org-a", ["OWNER", "ADMIN"]);
    expect(prisma.license.findMany).not.toHaveBeenCalled();
  });

  it("returns only licenses belonging to the authorized organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "ADMIN" });
    prisma.license.findMany.mockResolvedValue([{ id: "license-a", keyPrefix: "DZ-LICENSE", status: "ACTIVE" }]);

    const response = await GET(new Request("http://localhost/api/organizations/org-a/licenses"), context("org-a"));

    expect(response.status).toBe(200);
    expect(prisma.license.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a" },
    }));
    await expect(response.json()).resolves.toEqual({
      licenses: [{ id: "license-a", keyPrefix: "DZ-LICENSE", status: "ACTIVE" }],
    });
  });
});
