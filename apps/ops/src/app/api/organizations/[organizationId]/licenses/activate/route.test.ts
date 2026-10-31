import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prisma, requireTenantRole } = vi.hoisted(() => ({
  prisma: {
    license: { findUnique: vi.fn() },
    licenseActivation: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", STAFF: "STAFF" },
  Prisma: {
    TransactionIsolationLevel: { Serializable: "Serializable" },
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = "UNKNOWN";
    },
  },
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

const context = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });

describe("POST license activation API tenant boundary", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    prisma.license.findUnique.mockReset();
    prisma.licenseActivation.findUnique.mockReset();
    prisma.licenseActivation.count.mockReset();
    prisma.licenseActivation.create.mockReset();
    prisma.licenseActivation.update.mockReset();
    prisma.$transaction.mockReset();
  });

  it("does not activate a license owned by another organization", async () => {
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "OWNER" });
    prisma.license.findUnique.mockResolvedValue({
      id: "license-b",
      organizationId: "org-b",
      status: "ACTIVE",
      expiresAt: null,
      maxActivations: 3,
      subscription: { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) },
    });
    const request = new NextRequest("http://localhost/api/organizations/org-a/licenses/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        licenseKey: "DZ-LICENSE-KEY-012345678901234567890",
        installationId: "install_12345678",
        fingerprint: "fingerprint-value-123456",
      }),
    });

    const response = await POST(request, context("org-a"));

    expect(response.status).toBe(404);
    expect(prisma.license.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.licenseActivation.findUnique).not.toHaveBeenCalled();
    expect(prisma.licenseActivation.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
