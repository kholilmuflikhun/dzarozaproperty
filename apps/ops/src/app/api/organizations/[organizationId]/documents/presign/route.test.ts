import { beforeEach, describe, expect, it, vi } from "vitest";

const { canManageDocument, requireTenantContext, createPresignedUploadUrl, createPresignedDownloadUrl, createTenantDocumentKey, getR2Object, sha256Bytes, findFirst, create, projectFindFirst, invoiceFindFirst } = vi.hoisted(() => ({
  requireTenantContext: vi.fn(),
  canManageDocument: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  createPresignedDownloadUrl: vi.fn(),
  createTenantDocumentKey: vi.fn(),
  getR2Object: vi.fn(),
  sha256Bytes: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  projectFindFirst: vi.fn(),
  invoiceFindFirst: vi.fn(),
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

vi.mock("@/lib/document-access-query", () => ({ canManageDocument }));

vi.mock("@/lib/r2-storage", () => ({
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  createTenantDocumentKey,
  getR2Object,
  sha256Bytes,
}));

vi.mock("@dzaroza/database", () => ({ prisma: { document: { findFirst, create }, project: { findFirst: projectFindFirst }, invoice: { findFirst: invoiceFindFirst } } }));

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
    canManageDocument.mockReset();
    canManageDocument.mockResolvedValue(true);
    createPresignedUploadUrl.mockReset();
    createPresignedDownloadUrl.mockReset();
    createTenantDocumentKey.mockReset();
    getR2Object.mockReset();
    sha256Bytes.mockReset();
    findFirst.mockReset();
    create.mockReset();
    projectFindFirst.mockReset();
    invoiceFindFirst.mockReset();
    projectFindFirst.mockResolvedValue(null);
    invoiceFindFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "doc-a" });
    findFirst.mockResolvedValue(null);
    requireTenantContext.mockResolvedValue({ id: "member-a", organizationId: "org-a", userId: "user-a", role: "STAFF" });
    createTenantDocumentKey.mockReturnValue("organizations/org-a/documents/random/file.pdf");
    getR2Object.mockResolvedValue({ bytes: new Uint8Array([1,2,3,4]), contentLength: 1024, contentType: "application/pdf", etag: '"etag-a"' });
    sha256Bytes.mockResolvedValue("a".repeat(64));
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


  it("rejects project and invoice links outside the active organization before signing", async () => {
    const response = await POST(request({
      action: "upload", fileName: "file.pdf", contentType: "application/pdf", size: 1024, projectId: "project-foreign",
    }), context);
    expect(response.status).toBe(404);
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "project-foreign", organizationId: "org-a" }, select: { id: true, assignments: { where: { membershipId: "member-a", status: "ACTIVE" }, select: { id: true } } },
    });
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("derives the project link from a tenant-owned invoice", async () => {
    invoiceFindFirst.mockResolvedValue({ id: "invoice-a", projectId: "project-a", project: { clientId: "client-a" }, quotation: { clientId: "client-a" } });
    const response = await POST(request({
      action: "upload", fileName: "invoice.pdf", contentType: "application/pdf", size: 1024, invoiceId: "invoice-a",
    }), context);
    expect(response.status).toBe(200);
    expect(invoiceFindFirst).toHaveBeenCalledWith({
      where: { id: "invoice-a", organizationId: "org-a" }, select: {
        id: true, projectId: true, project: { select: { clientId: true } },
        quotation: { select: { clientId: true } },
      },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", projectId: "project-a", invoiceId: "invoice-a" }),
    }));
  });


  it("rejects linking a project from another client to an unassigned invoice", async () => {
    invoiceFindFirst.mockResolvedValue({ id: "invoice-a", projectId: null, quotation: { clientId: "client-a" } });
    projectFindFirst
      .mockResolvedValueOnce({ id: "project-other-client" })
      .mockResolvedValueOnce(null);
    const response = await POST(request({
      action: "upload", fileName: "invoice.pdf", contentType: "application/pdf", size: 1024,
      projectId: "project-other-client", invoiceId: "invoice-a",
    }), context);
    expect(response.status).toBe(422);
    expect(projectFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "project-other-client", organizationId: "org-a" },
      select: { id: true },
    });
    expect(projectFindFirst).toHaveBeenNthCalledWith(2, {
      where: { id: "project-other-client", organizationId: "org-a", clientId: "client-a" },
      select: { id: true },
    });
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an invoice whose linked project belongs to a different client than its quotation", async () => {
    invoiceFindFirst.mockResolvedValue({
      id: "invoice-a", projectId: "project-a", project: { clientId: "client-b" }, quotation: { clientId: "client-a" },
    });
    const response = await POST(request({
      action: "upload", fileName: "invoice.pdf", contentType: "application/pdf", size: 1024, invoiceId: "invoice-a",
    }), context);
    expect(response.status).toBe(422);
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects mismatched project and invoice associations", async () => {
    projectFindFirst.mockResolvedValue({ id: "project-a" });
    invoiceFindFirst.mockResolvedValue({ id: "invoice-a", projectId: "project-b", project: { clientId: "client-a" }, quotation: { clientId: "client-a" } });
    const response = await POST(request({
      action: "upload", fileName: "invoice.pdf", contentType: "application/pdf", size: 1024,
      projectId: "project-a", invoiceId: "invoice-a",
    }), context);
    expect(response.status).toBe(422);
    expect(createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
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
    findFirst.mockResolvedValue({ objectKey: "organizations/org-a/documents/random/file.pdf", etag: '"etag-a"', checksumSha256: "a".repeat(64), sizeBytes: 1024n, contentType: "application/pdf" });
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

  it("blocks downloads when the R2 object no longer matches finalized metadata", async () => {
    findFirst.mockResolvedValue({
      objectKey: "organizations/org-a/documents/random/file.pdf",
      etag: '"stored-etag"',
      checksumSha256: "a".repeat(64),
      sizeBytes: 1024n,
      contentType: "application/pdf",
    });
    getR2Object.mockResolvedValue({
      contentLength: 1024,
      contentType: "application/pdf",
      etag: '"overwritten-etag"',
    });
    const response = await POST(request({ action: "download", documentId: "doc-a" }), context);
    expect(response.status).toBe(409);
    expect(createPresignedDownloadUrl).not.toHaveBeenCalled();
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
