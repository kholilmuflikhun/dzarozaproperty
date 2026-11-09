import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { POST } from "./route";

const suffix = randomUUID();
const userId = `members-api-user-${suffix}`;
const orgAId = `members-api-org-a-${suffix}`;
const orgBId = `members-api-org-b-${suffix}`;

async function addMember(organizationId: string) {
  const request = new Request(`http://localhost/api/organizations/${organizationId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "new-member@example.invalid", role: "STAFF" }),
  }) as never;
  return POST(request, { params: Promise.resolve({ organizationId }) });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${suffix}@members-api-test.invalid` } });
  await prisma.organization.createMany({
    data: [
      { id: orgAId, name: "Members API Tenant A", slug: `members-api-a-${suffix}` },
      { id: orgBId, name: "Members API Tenant B", slug: `members-api-b-${suffix}` },
    ],
  });
  await prisma.membership.create({ data: { userId, organizationId: orgAId, role: "OWNER" } });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("members API with a real PostgreSQL tenant boundary", () => {
  it("rejects an authenticated user who is not a member of the target organization", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await addMember(orgBId);
    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests before processing membership data", async () => {
    getServerSession.mockResolvedValue({ user: {} });
    const response = await addMember(orgAId);
    expect(response.status).toBe(401);
  });
});
