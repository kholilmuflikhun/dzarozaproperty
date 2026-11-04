import { afterEach, describe, expect, it } from "vitest";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  createTenantDocumentKey,
  isTenantDocumentKey,
} from "./r2-storage";

const envKeys = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
] as const;

const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function configureR2() {
  process.env.R2_ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
  process.env.R2_BUCKET_NAME = "dzaroza-ops-preview";
  process.env.R2_ACCESS_KEY_ID = "preview-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "preview-secret-key-do-not-log";
  process.env.R2_ENDPOINT = "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com";
}

afterEach(() => {
  for (const key of envKeys) {
    const value = previousEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("R2 storage adapter", () => {
  it("creates a non-guessable object key scoped to the requested tenant", () => {
    const first = createTenantDocumentKey("org_123", "Kontrak final.pdf");
    const second = createTenantDocumentKey("org_123", "Kontrak final.pdf");

    expect(first).toMatch(/^organizations\/org_123\/documents\/[0-9a-f-]{36}\/Kontrak-final\.pdf$/);
    expect(second).not.toBe(first);
    expect(isTenantDocumentKey("org_123", first)).toBe(true);
    expect(isTenantDocumentKey("org_other", first)).toBe(false);
  });

  it("rejects traversal and foreign tenant object keys", () => {
    expect(isTenantDocumentKey("org_123", "organizations/org_123/documents/../../secret.pdf")).toBe(false);
    expect(isTenantDocumentKey("org_123", "organizations/org_other/documents/file.pdf")).toBe(false);
    expect(isTenantDocumentKey("org_123", "/organizations/org_123/documents/file.pdf")).toBe(false);
  });

  it("creates a short-lived signed PUT URL for the configured private bucket", async () => {
    configureR2();
    const key = "organizations/org_123/documents/file id/kontrak final.pdf";
    const result = await createPresignedUploadUrl(key, 300, "application/pdf");
    const url = new URL(result.url);

    expect(result.method).toBe("PUT");
    expect(result.expiresIn).toBe(300);
    expect(url.hostname).toBe("0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/dzaroza-ops-preview/organizations/org_123/documents/file%20id/kontrak%20final.pdf");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("preview-access-key/");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(result.headers).toEqual({ "Content-Type": "application/pdf" });
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(result.url).not.toContain("preview-secret-key-do-not-log");
  });

  it("creates a signed GET URL and rejects excessive URL lifetimes", async () => {
    configureR2();
    const result = await createPresignedDownloadUrl("organizations/org_123/documents/file.pdf");
    expect(result.method).toBe("GET");
    expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("300");
    await expect(createPresignedDownloadUrl("organizations/org_123/documents/file.pdf", 3600))
      .rejects.toThrow("expiry must be between");
  });

  it("rejects non-HTTPS and mismatched account endpoints", async () => {
    configureR2();
    process.env.R2_ENDPOINT = "https://example.com";
    await expect(createPresignedUploadUrl("organizations/org_123/documents/file.pdf"))
      .rejects.toThrow("R2_ENDPOINT must be the HTTPS S3 endpoint");
  });

  it("rejects invalid object keys", async () => {
    configureR2();
    await expect(createPresignedUploadUrl("../private.txt")).rejects.toThrow("R2 object key is invalid");
  });
});
