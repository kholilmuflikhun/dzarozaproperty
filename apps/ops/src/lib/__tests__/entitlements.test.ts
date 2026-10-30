import { describe, expect, it } from "vitest";
import { computeEntitlements, isLicenseEntitled } from "../licensing";

const plan = { code: "PRO", featureFlags: { crm: true, advancedReports: false }, maxUsers: 10, maxProjects: 50, maxStorageMb: 2048 };
describe("subscription entitlements", () => {
  const now = new Date("2026-10-31T00:00:00.000Z");
  it("exposes configured features and quotas for an active paid period", () => {
    const result = computeEntitlements({ status: "ACTIVE", currentPeriodEnd: new Date("2026-11-30T00:00:00.000Z"), plan }, now);
    expect(result.active).toBe(true);
    expect(result.planCode).toBe("PRO");
    expect(result.features.crm).toBe(true);
    expect(result.features.advancedReports).toBe(false);
    expect(result.limits.users).toBe(10);
  });
  it("disables paid features after the paid-through date", () => {
    const result = computeEntitlements({ status: "ACTIVE", currentPeriodEnd: new Date("2026-10-30T00:00:00.000Z"), plan }, now);
    expect(result.active).toBe(false);
    expect(result.features).toEqual({});
    expect(result.limits.projects).toBe(0);
  });
  it("does not grant access to incomplete subscriptions", () => {
    const result = computeEntitlements({ status: "INCOMPLETE", currentPeriodEnd: new Date("2026-11-30T00:00:00.000Z"), plan }, now);
    expect(result.active).toBe(false);
  });
  it("validates active license against its paid subscription and expiry", () => {
    expect(isLicenseEntitled({ status: "ACTIVE", expiresAt: new Date("2026-11-30T00:00:00Z"), subscriptionStatus: "ACTIVE", periodEnd: new Date("2026-11-30T00:00:00Z") }, now)).toBe(true);
    expect(isLicenseEntitled({ status: "REVOKED", expiresAt: null, subscriptionStatus: "ACTIVE", periodEnd: new Date("2026-11-30T00:00:00Z") }, now)).toBe(false);
  });
});
