import { describe, expect, it } from "vitest";
import { isPlatformAdminEmail } from "../platform-admin";

describe("platform admin allowlist", () => {
  it("matches emails case-insensitively and ignores whitespace", () => {
    expect(isPlatformAdminEmail(" ADMIN@example.com ", "admin@example.com, owner@example.com")).toBe(true);
  });
  it("rejects emails not present in the allowlist", () => {
    expect(isPlatformAdminEmail("staff@example.com", "admin@example.com")).toBe(false);
  });
  it("rejects missing email and empty allowlist", () => {
    expect(isPlatformAdminEmail(undefined, "admin@example.com")).toBe(false);
    expect(isPlatformAdminEmail("admin@example.com", " , ")).toBe(false);
  });
});
