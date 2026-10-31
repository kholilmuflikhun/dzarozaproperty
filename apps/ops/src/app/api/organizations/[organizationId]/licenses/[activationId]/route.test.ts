import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantRole } = vi.hoisted(() => ({
  prisma: {
    licenseActivation: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
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

import { DELETE } from "./route";

const context = (organizationId: string, activationId: string) => ({
  params: Promise.resolve({ organizationId, activationId }),
});

describe("DELETE license activation API tenant boundary", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    prisma.licenseActivation.findFirst.mockReset();
    prisma.licenseActivation.update.mockReset();
    prisma.auditLog.create.mockReset();
    prisma.$transaction.mockReset();
  });

  it("does not revoke an activation belonging to another organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "OWNER" });
    prisma.licenseActivation.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/organizations/org-a/licenses/activation-b", { method: "DELETE" }),
      context("org-a", "activation-b"),
    );

    expect(response.status).toBe(404);
    expect(prisma.licenseActivation.findFirst).toHaveBeenCalledWith({
      where: { id: "activation-b", license: { organizationId: "org-a" } },
      select: { id: true, revokedAt: true },
    });
    expect(prisma.licenseActivation.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a role outside OWNER and ADMIN before querying activation data", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));

    const response = await DELETE(
      new Request("http://localhost/api/organizations/org-a/licenses/activation-a", { method: "DELETE" }),
      context("org-a", "activation-a"),
    );

    expect(response.status).toBe(403);
    expect(requireTenantRole).toHaveBeenCalledWith("org-a", ["OWNER", "ADMIN"]);
    expect(prisma.licenseActivation.findFirst).not.toHaveBeenCalled();
  });
});
