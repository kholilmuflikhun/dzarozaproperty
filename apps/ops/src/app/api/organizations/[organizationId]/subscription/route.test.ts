import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantRole } = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTenantRole: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({
  prisma,
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", STAFF: "STAFF" },
}));
vi.mock("midtrans-client", () => ({ default: { Snap: vi.fn() } }));
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
  createLicenseSecret: vi.fn(),
  hashLicenseSecret: vi.fn(),
}));

import { POST } from "./route";

const context = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });
const request = (body: string) => new Request("http://localhost/api/organizations/org-a/subscription", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});

describe("POST organization subscription API authorization boundary", () => {
  beforeEach(() => {
    requireTenantRole.mockReset();
    prisma.organization.findUnique.mockReset();
    prisma.plan.findUnique.mockReset();
    prisma.$transaction.mockReset();
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");
    vi.stubEnv("MIDTRANS_CLIENT_KEY", "");
  });

  it("rejects unauthorized roles before reading organization or plan data", async () => {
    requireTenantRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));

    const response = await POST(request(JSON.stringify({ planCode: "STARTER", billingCycle: "MONTHLY" })) as never, context("org-a"));

    expect(response.status).toBe(403);
    expect(requireTenantRole).toHaveBeenCalledWith("org-a", ["OWNER", "ADMIN"]);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.plan.findUnique).not.toHaveBeenCalled();
  });

  it("returns service unavailable when Midtrans credentials are missing", async () => {
    requireTenantRole.mockResolvedValue({ userId: "user-a", role: "OWNER" });

    const response = await POST(request(JSON.stringify({ planCode: "STARTER", billingCycle: "MONTHLY" })) as never, context("org-a"));

    expect(response.status).toBe(503);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed checkout input before querying organization or plan", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "test-server-key");
    vi.stubEnv("MIDTRANS_CLIENT_KEY", "test-client-key");
    requireTenantRole.mockResolvedValue({ userId: "user-a", role: "OWNER" });

    const response = await POST(request("{invalid-json") as never, context("org-a"));

    expect(response.status).toBe(400);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
