import { describe, expect, it, vi } from "vitest";

vi.mock("@dzaroza/database", () => ({ prisma: { document: { findFirst: vi.fn() } } }));

import { authorizedDocumentWhere } from "./document-access-query";

const actor = (role: string) => ({ id: "member-a", userId: "user-a", organizationId: "org-a", role });

describe("authorized document list scopes", () => {
  it("grants Owner and Admin organization-wide access", () => {
    expect(authorizedDocumentWhere(actor("OWNER"))).toEqual({
      organizationId: "org-a", status: "AVAILABLE", deletedAt: null,
    });
    expect(authorizedDocumentWhere(actor("ADMIN"))).toEqual({
      organizationId: "org-a", status: "AVAILABLE", deletedAt: null,
    });
  });

  it("limits Finance to all organization invoices", () => {
    expect(authorizedDocumentWhere(actor("FINANCE"))).toEqual(expect.objectContaining({
      organizationId: "org-a",
      OR: [{ invoiceId: { not: null } }],
    }));
  });

  it("limits Project Managers to active PM assignments and linked invoice scopes", () => {
    const where = authorizedDocumentWhere(actor("PROJECT_MANAGER"));
    expect(where).toEqual(expect.objectContaining({
      OR: expect.arrayContaining([
        { project: { assignments: { some: { organizationId: "org-a", membershipId: "member-a", assignmentRole: "PROJECT_MANAGER", status: "ACTIVE" } } } },
        { invoice: { project: { assignments: { some: { organizationId: "org-a", membershipId: "member-a", assignmentRole: "PROJECT_MANAGER", status: "ACTIVE" } } } } },
      ]),
    }));
  });

  it("limits Staff to assigned project files and uploader-owned unlinked files", () => {
    expect(authorizedDocumentWhere(actor("STAFF"))).toEqual(expect.objectContaining({
      OR: [
        { projectId: { not: null }, invoiceId: null, project: { assignments: { some: { organizationId: "org-a", membershipId: "member-a", assignmentRole: { in: ["CONTRIBUTOR", "VIEWER"] }, status: "ACTIVE" } } } },
        { projectId: null, invoiceId: null, uploadedById: "user-a" },
      ],
    }));
  });

  it("requires explicit client grants for Sales and Client Portal reads", () => {
    const sales = authorizedDocumentWhere(actor("SALES"));
    const client = authorizedDocumentWhere(actor("CLIENT"));
    expect(JSON.stringify(sales)).toContain("salesAccesses");
    expect(JSON.stringify(client)).toContain("portalAccesses");
    expect(sales).not.toEqual(client);
  });

  it("denies unknown roles by returning an empty scope", () => {
    expect(authorizedDocumentWhere(actor("UNKNOWN"))).toEqual(expect.objectContaining({ OR: [] }));
  });
});
