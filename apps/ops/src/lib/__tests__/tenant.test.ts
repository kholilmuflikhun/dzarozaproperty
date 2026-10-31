import { describe, expect, it } from "vitest";
import { membershipHasAllowedRole, membershipMatchesTenant } from "../tenant-policy";

describe("tenant membership boundary", () => {
  const membership = { organizationId: "org-a", userId: "user-a", role: "OWNER" as const };
  it("accepts only the exact organization and user pair", () => {
    expect(membershipMatchesTenant(membership, "org-a", "user-a")).toBe(true);
  });
  it("rejects a different organization even when the user is the same", () => {
    expect(membershipMatchesTenant(membership, "org-b", "user-a")).toBe(false);
  });
  it("rejects a different user even when the organization is the same", () => {
    expect(membershipMatchesTenant(membership, "org-a", "user-b")).toBe(false);
  });
  it("rejects missing membership", () => {
    expect(membershipMatchesTenant(null, "org-a", "user-a")).toBe(false);
  });
});

describe("tenant role authorization boundary", () => {
  it("allows a role explicitly included in the route policy", () => {
    expect(membershipHasAllowedRole({ role: "OWNER" }, ["OWNER", "ADMIN"])).toBe(true);
  });
  it("allows another explicitly permitted role", () => {
    expect(membershipHasAllowedRole({ role: "ADMIN" }, ["OWNER", "ADMIN"])).toBe(true);
  });
  it("rejects a valid tenant member whose role is not permitted", () => {
    expect(membershipHasAllowedRole({ role: "STAFF" }, ["OWNER", "ADMIN"])).toBe(false);
  });
  it("rejects absent membership", () => {
    expect(membershipHasAllowedRole(null, ["OWNER", "ADMIN"])).toBe(false);
  });
  it("rejects an empty allowlist", () => {
    expect(membershipHasAllowedRole({ role: "OWNER" }, [])).toBe(false);
  });
});
