import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { GET } from "./route";

const suffix = randomUUID();
const userId = `api-tenant-user-${suffix}`;
const orgAId = `api-tenant-org-a-${suffix}`;
const orgBId = `api-tenant-org-b-${suffix}`;

async function getProjects(organizationId: string) {
  const request = new Request(
    `http://localhost/api/organizations/${organizationId}/projects`,
  ) as never;
  return GET(request, { params: Promise.resolve({ organizationId }) });
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: userId, email: `${suffix}@api-tenant-test.invalid` },
  });
  await prisma.organization.createMany({
    data: [
      { id: orgAId, name: "API Tenant A", slug: `api-tenant-a-${suffix}` },
      { id: orgBId, name: "API Tenant B", slug: `api-tenant-b-${suffix}` },
    ],
  });
  await prisma.membership.create({
    data: { userId, organizationId: orgAId, role: "OWNER" },
  });

  const clientA = await prisma.client.create({
    data: { organizationId: orgAId, name: "Client A - private" },
  });
  const clientB = await prisma.client.create({
    data: { organizationId: orgBId, name: "Client B - private" },
  });

  await prisma.project.createMany({
    data: [
      {
        organizationId: orgAId,
        clientId: clientA.id,
        code: `A-${suffix.slice(0, 8)}`,
        name: "Project A - visible to member",
      },
      {
        organizationId: orgBId,
        clientId: clientB.id,
        code: `B-${suffix.slice(0, 8)}`,
        name: "Project B - must remain private",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({
    where: { id: { in: [orgAId, orgBId] } },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("projects API with a real PostgreSQL tenant boundary", () => {
  it("returns only the requesting member's organization projects", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });

    const response = await getProjects(orgAId);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.projects).toHaveLength(1);
    expect(payload.projects[0]).toMatchObject({
      organizationId: orgAId,
      name: "Project A - visible to member",
    });
    expect(payload.projects.some((project: { name: string }) =>
      project.name === "Project B - must remain private",
    )).toBe(false);
  });

  it("rejects the same authenticated user from another organization before querying its projects", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });

    const response = await getProjects(orgBId);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "Akses ke organisasi atau tindakan ini tidak diizinkan." });
  });

  it("rejects requests without an authenticated user", async () => {
    getServerSession.mockResolvedValue({ user: {} });

    const response = await getProjects(orgAId);

    expect(response.status).toBe(401);
  });
});
