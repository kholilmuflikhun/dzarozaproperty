import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  headR2Object,
  getR2Object,
  sha256Bytes,
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
  vi.unstubAllGlobals();
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
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host;if-none-match");
    expect(result.headers).toEqual({ "Content-Type": "application/pdf", "If-None-Match": "*" });
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(result.url).not.toContain("preview-secret-key-do-not-log");
  });

  it("signs the create-once condition into every presigned PUT request", async () => {
    configureR2();
    const result = await createPresignedUploadUrl(
      "organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/file.pdf",
      300,
      "application/pdf",
    );
    expect(result.headers).toEqual({
      "Content-Type": "application/pdf",
      "If-None-Match": "*",
    });
    expect(new URL(result.url).searchParams.get("X-Amz-SignedHeaders"))
      .toBe("content-type;host;if-none-match");
  });

  it("creates a signed GET URL and rejects excessive URL lifetimes", async () => {
    configureR2();
    const result = await createPresignedDownloadUrl("organizations/org_123/documents/file.pdf");
    expect(result.method).toBe("GET");
    expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("300");
    await expect(createPresignedDownloadUrl("organizations/org_123/documents/file.pdf", 3600))
      .rejects.toThrow("expiry must be between");
  });


  it("verifies an uploaded object using a signed HEAD request", async () => {
    configureR2();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200,
      headers: {
        "content-length": "2048",
        "content-type": "application/pdf",
        etag: '"r2-etag"',
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await headR2Object("organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("X-Amz-Signature="), {
      method: "HEAD",
      cache: "no-store",
    });
    expect(result).toEqual({
      contentLength: 2048,
      contentType: "application/pdf",
      etag: '"r2-etag"',
    });
  });

  it("returns null when an uploaded object is missing", async () => {
    configureR2();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(headR2Object("organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/missing.pdf"))
      .resolves.toBeNull();
  });


  it("downloads a bounded R2 object body for independent content verification", async () => {
    configureR2();
    const bytes = new TextEncoder().encode("%PDF-1.7");
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, {
      status: 200,
      headers: {
        "content-length": String(bytes.byteLength),
        "content-type": "application/pdf",
        etag: '"r2-etag"',
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getR2Object("organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf", 1024);
    expect(result?.contentLength).toBe(bytes.byteLength);
    expect(result?.contentType).toBe("application/pdf");
    expect(result?.etag).toBe('"r2-etag"');
    expect(Array.from(result?.bytes ?? [])).toEqual(Array.from(bytes));
  });

  it("rejects R2 object bodies larger than the configured verification limit", async () => {
    configureR2();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(16), {
      status: 200,
      headers: { "content-length": "16", "content-type": "application/pdf" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getR2Object("organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/large.pdf", 8))
      .rejects.toThrow("invalid or excessive content length");
  });

  it("stops streaming immediately when the actual R2 body exceeds the limit despite a smaller Content-Length", async () => {
    configureR2();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
      },
      cancel() { cancelled = true; },
    });
    const response = new Response(body, {
      status: 200,
      headers: {
        "content-length": "8",
        "content-type": "application/pdf",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(getR2Object(
      "organizations/org_123/documents/123e4567-e89b-12d3-a456-426614174000/oversized.pdf",
      12,
    )).rejects.toThrow("exceeds its declared or configured size limit");
    expect(cancelled).toBe(true);
  });

  it("computes a SHA-256 digest from the actual object bytes", async () => {
    const digest = await sha256Bytes(new TextEncoder().encode("abc"));
    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
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
