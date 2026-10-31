import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prisma, requireTenantRole, isLicenseEntitled } = vi.hoisted(() => ({
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
  isLicenseEntitled: vi.fn(),
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
vi.mock("@/lib/licensing", () => ({
  hashLicenseSecret: vi.fn(() => "hashed-license-key"),
  isLicenseEntitled,
}));

import { POST } from "./route";

const context = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });
const makeRequest = (organizationId = "org-a") => new NextRequest(`http://localhost/api/organizations/${organizationId}/licenses/activate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    licenseKey: "DZ-LICENSE-KEY-012345678901234567890",
    installationId: "install_12345678",
    fingerprint: "fingerprint-value-123456",
  }),
});
const validLicense = (organizationId = "org-a") => ({
  id: "license-a",
  organizationId,
  status: "ACTIVE",
  expiresAt: null,
  maxActivations: 2,
  subscription: { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) },
});

describe("POST license activation API tenant boundary and lifecycle", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "OWNER" });
    isLicenseEntitled.mockReset();
    isLicenseEntitled.mockReturnValue(true);
    prisma.license.findUnique.mockReset();
    prisma.licenseActivation.findUnique.mockReset();
    prisma.licenseActivation.count.mockReset();
    prisma.licenseActivation.create.mockReset();
    prisma.licenseActivation.update.mockReset();
    prisma.$transaction.mockReset();
  });

  it("does not activate a license owned by another organization", async () => {
    prisma.license.findUnique.mockResolvedValue(validLicense("org-b"));

    const response = await POST(makeRequest(), context("org-a"));

    expect(response.status).toBe(404);
    expect(prisma.license.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.licenseActivation.findUnique).not.toHaveBeenCalled();
    expect(prisma.licenseActivation.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired or non-entitled license before starting an activation transaction", async () => {
    prisma.license.findUnique.mockResolvedValue(validLicense());
    isLicenseEntitled.mockReturnValue(false);

    const response = await POST(makeRequest(), context("org-a"));

    expect(response.status).toBe(404);
    expect(isLicenseEntitled).toHaveBeenCalledOnce();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refreshes an existing active installation idempotently without consuming another activation slot", async () => {
    prisma.license.findUnique.mockResolvedValue(validLicense());
    const existing = { id: "activation-a", revokedAt: null };
    const updated = { id: "activation-a", activatedAt: new Date("2026-10-01T00:00:00.000Z") };
    const tx = {
      licenseActivation: {
        findUnique: vi.fn().mockResolvedValue(existing),
        count: vi.fn(),
        update: vi.fn().mockResolvedValue(updated),
        create: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(makeRequest(), context("org-a"));

    expect(response.status).toBe(200);
    expect(tx.licenseActivation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "activation-a" },
      data: expect.objectContaining({ fingerprintHash: expect.any(String), lastSeenAt: expect.any(Date) }),
    }));
    expect(tx.licenseActivation.count).not.toHaveBeenCalled();
    expect(tx.licenseActivation.create).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      activationId: "activation-a",
      activatedAt: updated.activatedAt,
    });
  });

  it("rejects a new installation when the activation limit has been reached", async () => {
    prisma.license.findUnique.mockResolvedValue(validLicense());
    const tx = {
      licenseActivation: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(makeRequest(), context("org-a"));

    expect(response.status).toBe(409);
    expect(tx.licenseActivation.count).toHaveBeenCalledWith({ where: { licenseId: "license-a", revokedAt: null } });
    expect(tx.licenseActivation.create).not.toHaveBeenCalled();
  });

  it("creates a new activation when entitlement and activation capacity are valid", async () => {
    prisma.license.findUnique.mockResolvedValue(validLicense());
    const created = { id: "activation-new", activatedAt: new Date("2026-10-31T00:00:00.000Z") };
    const tx = {
      licenseActivation: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const response = await POST(makeRequest(), context("org-a"));

    expect(response.status).toBe(200);
    expect(tx.licenseActivation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        licenseId: "license-a",
        installationId: "install_12345678",
        activatedById: "user-a",
      }),
    }));
    await expect(response.json()).resolves.toEqual({
      activationId: "activation-new",
      activatedAt: created.activatedAt,
    });
  });
});
