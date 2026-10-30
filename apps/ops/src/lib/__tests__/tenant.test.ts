import { describe, expect, it } from "vitest";
import { membershipMatchesTenant } from "../tenant-policy";

describe("tenant membership boundary", () => {
  const membership = { organizationId: "org-a", userId: "user-a" };
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
