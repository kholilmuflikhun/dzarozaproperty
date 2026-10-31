import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantContext } = vi.hoisted(() => ({
  prisma: {
    client: { count: vi.fn() },
    lead: { count: vi.fn() },
    project: { count: vi.fn() },
    invoice: { count: vi.fn() },
  },
  requireTenantContext: vi.fn(),
}));

vi.mock("@dzaroza/database", () => ({ prisma }));
vi.mock("@/lib/tenant", () => ({
  requireTenantContext,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));

import { GET } from "./route";

const context = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });

describe("GET organization summary API tenant boundary", () => {
  beforeEach(() => {
    requireTenantContext.mockReset();
    prisma.client.count.mockReset();
    prisma.lead.count.mockReset();
    prisma.project.count.mockReset();
    prisma.invoice.count.mockReset();
  });

  it("returns 401 and does not query tenant data without a session", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Unauthenticated"), { name: "UnauthorizedError" }));

    const response = await GET(new Request("http://localhost/api/organizations/org-a/summary"), context("org-a"));

    expect(response.status).toBe(401);
    expect(prisma.client.count).not.toHaveBeenCalled();
    expect(prisma.lead.count).not.toHaveBeenCalled();
    expect(prisma.project.count).not.toHaveBeenCalled();
    expect(prisma.invoice.count).not.toHaveBeenCalled();
  });

  it("returns 403 and does not query data when the user has no membership in the requested tenant", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));

    const response = await GET(new Request("http://localhost/api/organizations/org-b/summary"), context("org-b"));

    expect(response.status).toBe(403);
    expect(requireTenantContext).toHaveBeenCalledWith("org-b");
    expect(prisma.client.count).not.toHaveBeenCalled();
    expect(prisma.lead.count).not.toHaveBeenCalled();
    expect(prisma.project.count).not.toHaveBeenCalled();
    expect(prisma.invoice.count).not.toHaveBeenCalled();
  });

  it("scopes every summary count to the authorized organization", async () => {
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "OWNER" });
    prisma.client.count.mockResolvedValue(2);
    prisma.lead.count.mockResolvedValue(3);
    prisma.project.count.mockResolvedValue(4);
    prisma.invoice.count.mockResolvedValue(5);

    const response = await GET(new Request("http://localhost/api/organizations/org-a/summary"), context("org-a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: "org-a",
      counts: { clients: 2, leads: 3, projects: 4, openInvoices: 5 },
    });
    expect(prisma.client.count).toHaveBeenCalledWith({ where: { organizationId: "org-a" } });
    expect(prisma.lead.count).toHaveBeenCalledWith({ where: { organizationId: "org-a" } });
    expect(prisma.project.count).toHaveBeenCalledWith({ where: { organizationId: "org-a" } });
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", status: { notIn: ["PAID", "VOID"] } },
    });
  });
});
