import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createLicenseSecret() {
  return `DZROZA-${randomBytes(32).toString("base64url")}`;
}
export function hashLicenseSecret(secret: string) {
  return createHash("sha256").update(secret.trim()).digest("hex");
}
export function verifyLicenseSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashLicenseSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
