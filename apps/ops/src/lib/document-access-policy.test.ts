import { describe, expect, it } from "vitest";
import { canAccessDocument, canManageProjectAssignments } from "./document-access-policy";

describe("document access policy", () => {
  it("grants Finance organization-wide invoice access", () => {
    expect(canAccessDocument({ role: "FINANCE", userId: "f", scope: "INVOICE" }, "READ")).toBe(true);
    expect(canAccessDocument({ role: "FINANCE", userId: "f", scope: "INVOICE" }, "UPLOAD")).toBe(true);
  });
  it("limits Project Manager finance access to read-only invoices in assigned projects", () => {
    const base = { role: "PROJECT_MANAGER" as const, userId: "pm", scope: "INVOICE" as const, projectLinkedToInvoice: true, projectAssignment: "ACTIVE" as const };
    expect(canAccessDocument(base, "READ")).toBe(true);
    expect(canAccessDocument(base, "DOWNLOAD")).toBe(true);
    expect(canAccessDocument(base, "UPLOAD")).toBe(false);
    expect(canAccessDocument({ ...base, projectAssignment: "REVOKED" }, "READ")).toBe(false);
    expect(canAccessDocument({ ...base, projectLinkedToInvoice: false }, "READ")).toBe(false);
  });
  it("retains Sales read access only for explicitly assigned client records", () => {
    expect(canAccessDocument({ role: "SALES", userId: "s", scope: "CLIENT", salesClientAccess: true }, "READ")).toBe(true);
    expect(canAccessDocument({ role: "SALES", userId: "s", scope: "CLIENT", salesClientAccess: false }, "READ")).toBe(false);
    expect(canAccessDocument({ role: "SALES", userId: "s", scope: "INVOICE" }, "READ")).toBe(false);
  });
  it("allows Staff to finalize only their own uploads in an assigned project", () => {
    const base = { role: "STAFF" as const, userId: "staff", scope: "PROJECT" as const, projectAssignment: "ACTIVE" as const };
    expect(canAccessDocument({ ...base, uploaderId: "staff" }, "FINALIZE")).toBe(true);
    expect(canAccessDocument({ ...base, uploaderId: "other" }, "FINALIZE")).toBe(false);
    expect(canAccessDocument({ ...base, projectAssignment: "REVOKED", uploaderId: "staff" }, "READ")).toBe(false);
  });
  it("requires explicit Client Portal linkage and read-only access", () => {
    const base = { role: "CLIENT" as const, userId: "client", scope: "PROJECT" as const, clientPortalAccess: true };
    expect(canAccessDocument(base, "READ")).toBe(true);
    expect(canAccessDocument(base, "UPLOAD")).toBe(false);
    expect(canAccessDocument({ ...base, clientPortalAccess: false }, "READ")).toBe(false);
  });
  it("denies invalid scopes and scopes assignment administration", () => {
    expect(canAccessDocument({ role: "STAFF", userId: "u", scope: "INVALID" }, "READ")).toBe(false);
    expect(canManageProjectAssignments("OWNER")).toBe(true);
    expect(canManageProjectAssignments("PROJECT_MANAGER", true)).toBe(true);
    expect(canManageProjectAssignments("PROJECT_MANAGER", false)).toBe(false);
    expect(canManageProjectAssignments("STAFF")).toBe(false);
  });
});
