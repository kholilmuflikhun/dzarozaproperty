import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireTenantContext, createPresignedUploadUrl, createPresignedDownloadUrl, createTenantDocumentKey, headR2Object, findFirst, create } = vi.hoisted(() => ({
  requireTenantContext: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  createPresignedDownloadUrl: vi.fn(),
  createTenantDocumentKey: vi.fn(),
  headR2Object: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenantContext,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ditolak." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));

vi.mock("@/lib/r2-storage", () => ({
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  createTenantDocumentKey,
  headR2Object,
}));

vi.mock("@dzaroza/database", () => ({ prisma: { document: { findFirst, create } } }));

import { POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a" }) };
const request = (body: unknown) => new Request("http://localhost/api/organizations/org-a/documents/presign", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}) as never;

describe("tenant-scoped R2 presign API", () => {
  beforeEach(() => {
    requireTenantContext.mockReset();
    createPresignedUploadUrl.mockReset();
    createPresignedDownloadUrl.mockReset();
    createTenantDocumentKey.mockReset();
    headR2Object.mockReset();
    findFirst.mockReset();
    create.mockReset();
    create.mockResolvedValue({ id: "doc-a" });
    findFirst.mockResolvedValue(null);
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    createTenantDocumentKey.mockReturnValue("organizations/org-a/documents/random/file.pdf");
    headR2Object.mockResolvedValue({ contentLength: 1024, contentType: "application/pdf", etag: '"etag-a"' });
    createPresignedUploadUrl.mockResolvedValue({
      method: "PUT", url: "https://r2.example/signed-upload", expiresIn: 300, headers: { "Content-Type": "application/pdf" },
    });
    createPresignedDownloadUrl.mockResolvedValue({
      method: "GET", url: "https://r2.example/signed-download", expiresIn: 300,
    });
  });

  it("authorizes tenant membership before issuing a short-lived upload URL", async () => {
    const response = await POST(request({
      action: "upload", fileName: "file.pdf", contentType: "application/pdf", size: 1024,
    }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireTenantContext).toHaveBeenCalledWith("org-a");
    expect(createTenantDocumentKey).toHaveBeenCalledWith("org-a", "file.pdf");
    expect(createPresignedUploadUrl).toHaveBeenCalledWith(
      "organizations/org-a/documents/random/file.pdf", 300, "application/pdf",
    );
    expect(body.upload.method).toBe("PUT");
    expect(body.upload.expiresIn).toBe(300);
    expect(body.upload.documentId).toBe("doc-a");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-a",
        uploadedById: "user-a",
        fileName: "file.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024n,
        status: "PENDING_UPLOAD",
      }),
    }));
  });

  it("rejects files with unsupported types or excessive sizes", async () => {
    const unsupported = await POST(request({
      action: "upload", fileName: "script.js", contentType: "application/javascript", size: 10,
    }), context);
    const tooLarge = await POST(request({
      action: "upload", fileName: "large.pdf", contentType: "application/pdf", size: 21 * 1024 * 1024,
    }), context);
    expect(unsupported.status).toBe(400);
    expect(tooLarge.status).toBe(400);
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not issue a download URL for a missing or foreign tenant document", async () => {
    const response = await POST(request({
      action: "download", documentId: "doc-foreign",
    }), context);
    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "doc-foreign", organizationId: "org-a", status: "AVAILABLE", deletedAt: null },
    }));
    expect(createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("issues a download URL only for an AVAILABLE document in the active tenant", async () => {
    findFirst.mockResolvedValue({ objectKey: "organizations/org-a/documents/random/file.pdf", etag: '"etag-a"', sizeBytes: 1024n, contentType: "application/pdf" });
    const response = await POST(request({
      action: "download", documentId: "doc-a",
    }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(createPresignedDownloadUrl).toHaveBeenCalledWith(
      "organizations/org-a/documents/random/file.pdf", 300,
    );
    expect(body.download.method).toBe("GET");
  });

  it("does not create signed URLs when membership authorization fails", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }));
    const response = await POST(request({
      action: "upload", fileName: "file.pdf", contentType: "application/pdf", size: 1024,
    }), context);
    expect(response.status).toBe(403);
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
  });
});
