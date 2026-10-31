import { describe, expect, it } from "vitest";
import { createLicenseSecret, hashLicenseSecret, verifyLicenseSecret } from "../license-crypto";

describe("license secret primitives", () => {
  it("generates high-entropy prefixed secrets", () => {
    const key = createLicenseSecret();
    expect(key.startsWith("DZROZA-")).toBe(true);
    expect(key.length).toBeGreaterThan(40);
  });
  it("hashes deterministically and verifies without storing plaintext", () => {
    const key = createLicenseSecret();
    const hash = hashLicenseSecret(key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLicenseSecret(key)).toBe(hash);
    expect(verifyLicenseSecret(key, hash)).toBe(true);
    expect(verifyLicenseSecret(`${key}-wrong`, hash)).toBe(false);
  });
});
