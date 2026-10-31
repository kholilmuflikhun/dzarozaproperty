import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { GET } from "./route";

const suffix = randomUUID();
const userId = `clients-api-user-${suffix}`;
const orgAId = `clients-api-org-a-${suffix}`;
const orgBId = `clients-api-org-b-${suffix}`;

async function getClients(organizationId: string) {
  const request = new Request(`http://localhost/api/organizations/${organizationId}/clients`) as never;
  return GET(request, { params: Promise.resolve({ organizationId }) });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${suffix}@clients-api-test.invalid` } });
  await prisma.organization.createMany({
    data: [
      { id: orgAId, name: "Clients API Tenant A", slug: `clients-api-a-${suffix}` },
      { id: orgBId, name: "Clients API Tenant B", slug: `clients-api-b-${suffix}` },
    ],
  });
  await prisma.membership.create({ data: { userId, organizationId: orgAId, role: "OWNER" } });
  await prisma.client.createMany({
    data: [
      { organizationId: orgAId, name: "Client A - visible" },
      { organizationId: orgBId, name: "Client B - private" },
    ],
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("clients API with a real PostgreSQL tenant boundary", () => {
  it("returns only clients belonging to the authorized organization", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await getClients(orgAId);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clients).toHaveLength(1);
    expect(payload.clients[0]).toMatchObject({ organizationId: orgAId, name: "Client A - visible" });
    expect(payload.clients.some((client: { name: string }) => client.name === "Client B - private")).toBe(false);
  });

  it("denies access to a different organization without querying its data", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await getClients(orgBId);
    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    getServerSession.mockResolvedValue({ user: {} });
    const response = await getClients(orgAId);
    expect(response.status).toBe(401);
  });
});
