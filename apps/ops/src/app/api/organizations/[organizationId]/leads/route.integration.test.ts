import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));

import { prisma } from "@dzaroza/database";
import { GET, POST } from "./route";

const suffix = randomUUID();
const userId = `leads-api-user-${suffix}`;
const orgAId = `leads-api-org-a-${suffix}`;
const orgBId = `leads-api-org-b-${suffix}`;
let clientAId = "";
let clientBId = "";

function getLeads(organizationId: string) {
  const request = new Request(`http://localhost/api/organizations/${organizationId}/leads`) as never;
  return GET(request, { params: Promise.resolve({ organizationId }) });
}

function createLead(organizationId: string, payload: unknown) {
  const request = new Request(`http://localhost/api/organizations/${organizationId}/leads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as never;
  return POST(request, { params: Promise.resolve({ organizationId }) });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, email: `${suffix}@leads-api-test.invalid` } });
  await prisma.organization.createMany({
    data: [
      { id: orgAId, name: "Leads API Tenant A", slug: `leads-api-a-${suffix}` },
      { id: orgBId, name: "Leads API Tenant B", slug: `leads-api-b-${suffix}` },
    ],
  });
  await prisma.membership.create({ data: { userId, organizationId: orgAId, role: "OWNER" } });
  const [clientA, clientB] = await Promise.all([
    prisma.client.create({ data: { organizationId: orgAId, name: "Client A" } }),
    prisma.client.create({ data: { organizationId: orgBId, name: "Client B" } }),
  ]);
  clientAId = clientA.id;
  clientBId = clientB.id;
  await prisma.lead.createMany({
    data: [
      { organizationId: orgAId, title: "Lead A private scope", contactName: "A Contact" },
      { organizationId: orgBId, title: "Lead B private scope", contactName: "B Contact" },
    ],
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("CRM leads API with a real PostgreSQL tenant boundary", () => {
  it("returns only leads belonging to the authorized organization", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await getLeads(orgAId);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.leads).toHaveLength(1);
    expect(payload.leads[0]).toMatchObject({ organizationId: orgAId, title: "Lead A private scope" });
  });

  it("denies cross-tenant reads and unauthenticated requests", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    expect((await getLeads(orgBId)).status).toBe(403);

    getServerSession.mockResolvedValue({ user: {} });
    expect((await getLeads(orgAId)).status).toBe(401);
  });

  it("creates a lead and its audit record in the authorized tenant", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await createLead(orgAId, {
      title: "New construction opportunity",
      contactName: "Test Contact",
      clientId: clientAId,
      estimatedValue: 250000000,
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.lead).toMatchObject({ organizationId: orgAId, clientId: clientAId, stage: "NEW" });
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: orgAId, entityType: "Lead", entityId: payload.lead.id, action: "lead.created" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a client from another organization without creating a lead", async () => {
    getServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await createLead(orgAId, {
      title: "Cross-tenant client attempt",
      contactName: "Test Contact",
      clientId: clientBId,
    });

    expect(response.status).toBe(404);
    expect(await prisma.lead.count({ where: { organizationId: orgAId, title: "Cross-tenant client attempt" } })).toBe(0);
  });
});
