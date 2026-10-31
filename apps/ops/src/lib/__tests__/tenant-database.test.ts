import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@dzaroza/database";
import { findTenantMembership } from "../tenant-data";

const suffix = crypto.randomUUID();
const userId = `test-user-${suffix}`;
const orgAId = `test-org-a-${suffix}`;
const orgBId = `test-org-b-${suffix}`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${suffix}@tenant-test.invalid` } });
  await prisma.organization.create({ data: { id: orgAId, name: "Tenant A", slug: `tenant-a-${suffix}` } });
  await prisma.organization.create({ data: { id: orgBId, name: "Tenant B", slug: `tenant-b-${suffix}` } });
  await prisma.membership.create({ data: { userId, organizationId: orgAId, role: "OWNER" } });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("database tenant isolation", () => {
  it("resolves the user's own organization membership", async () => {
    const membership = await findTenantMembership(userId, orgAId);
    expect(membership?.organizationId).toBe(orgAId);
    expect(membership?.userId).toBe(userId);
  });
  it("returns no membership for a different tenant", async () => {
    const membership = await findTenantMembership(userId, orgBId);
    expect(membership).toBeNull();
  });
});
