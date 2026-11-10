import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireTenantContext, headR2Object, isTenantDocumentKey, findMany, findUnique, updateMany } = vi.hoisted(() => ({
  requireTenantContext: vi.fn(),
  headR2Object: vi.fn(),
  isTenantDocumentKey: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenantContext,
  toHttpError: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { status: 401, message: "Autentikasi diperlukan." };
    if (name === "ForbiddenError") return { status: 403, message: "Akses ke organisasi atau tindakan ini tidak diizinkan." };
    return { status: 500, message: "Terjadi kesalahan pada server." };
  },
}));

vi.mock("@/lib/r2-storage", () => ({ headR2Object, isTenantDocumentKey }));
vi.mock("@dzaroza/database", () => ({
  prisma: { document: { findMany, findUnique, updateMany } },
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a" }) };
const request = (body: unknown) => new Request("http://localhost/api/organizations/org-a/documents", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}) as never;

describe("tenant-scoped document metadata API", () => {
  beforeEach(() => {
    requireTenantContext.mockReset();
    headR2Object.mockReset();
    isTenantDocumentKey.mockReset();
    findMany.mockReset();
    findUnique.mockReset();
    updateMany.mockReset();
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    isTenantDocumentKey.mockReturnValue(true);
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue(null);
    headR2Object.mockResolvedValue({
      contentLength: 2048,
      contentType: "application/pdf",
      etag: '"r2-etag"',
    });
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({
      id: "doc-a",
      organizationId: "org-a",
      fileName: "contract.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048n,
      etag: '"r2-etag"',
      status: "AVAILABLE",
      projectId: null,
      invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"),
    });
  });

  it("lists only available, non-deleted documents for the active tenant", async () => {
    findMany.mockResolvedValue([{
      id: "doc-a", fileName: "contract.pdf", contentType: "application/pdf",
      sizeBytes: 2048n, etag: '"r2-etag"', status: "AVAILABLE",
      projectId: null, invoiceId: null, createdAt: new Date("2026-11-04T00:00:00.000Z"),
    }]);
    const response = await GET(new Request("http://localhost/api/organizations/org-a/documents") as never, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", status: "AVAILABLE", deletedAt: null },
    }));
    expect(body.documents[0].sizeBytes).toBe("2048");
  });

  it("verifies R2 metadata before promoting a pending document to AVAILABLE", async () => {
    findUnique.mockResolvedValueOnce({
      id: "doc-a", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 2048n, etag: null,
      status: "PENDING_UPLOAD", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(requireTenantContext).toHaveBeenCalledWith("org-a");
    expect(headR2Object).toHaveBeenCalledWith("organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "doc-a", organizationId: "org-a", status: "PENDING_UPLOAD", deletedAt: null },
      data: { status: "AVAILABLE", etag: '"r2-etag"' },
    }));
    expect(body.document.sizeBytes).toBe("2048");
  });

  it("rejects object keys outside the active tenant", async () => {
    isTenantDocumentKey.mockReturnValue(false);
    const response = await POST(request({ objectKey: "organizations/org-b/documents/secret.pdf" }), context);
    expect(response.status).toBe(404);
    expect(headR2Object).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not finalize a pending upload when the object is missing from R2", async () => {
    findUnique.mockResolvedValue({
      id: "doc-a", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 2048n, etag: null,
      status: "PENDING_UPLOAD", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    headR2Object.mockResolvedValue(null);
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    expect(response.status).toBe(404);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects finalization when the uploaded object's size differs from the pending record", async () => {
    findUnique.mockResolvedValue({
      id: "doc-a", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 2048n, etag: null,
      status: "PENDING_UPLOAD", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    headR2Object.mockResolvedValue({
      contentLength: 4096, contentType: "application/pdf", etag: '"r2-etag"',
    });
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    expect(response.status).toBe(422);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects files with unsupported content types or excessive size", async () => {
    findUnique.mockResolvedValue({
      id: "doc-a", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 1024n, etag: null,
      status: "PENDING_UPLOAD", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    headR2Object.mockResolvedValueOnce({
      contentLength: 1024, contentType: "application/javascript", etag: null,
    });
    const unsupported = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/script.js",
    }), context);
    headR2Object.mockResolvedValueOnce({
      contentLength: 21 * 1024 * 1024, contentType: "application/pdf", etag: null,
    });
    const tooLarge = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/large.pdf",
    }), context);
    expect(unsupported.status).toBe(422);
    expect(tooLarge.status).toBe(422);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("returns an existing finalized document idempotently", async () => {
    findUnique.mockResolvedValue({
      id: "doc-existing", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 2048n, etag: '"r2-etag"',
      status: "AVAILABLE", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    headR2Object.mockResolvedValue({
      contentLength: 2048, contentType: "application/pdf", etag: '"r2-etag"',
    });
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.alreadyFinalized).toBe(true);
    expect(headR2Object).toHaveBeenCalledTimes(1);
  });
  it("returns 403 for document listing before querying storage when membership is denied", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Akses ke organisasi atau tindakan ini tidak diizinkan."), { name: "ForbiddenError" }));
    const response = await GET(new Request("http://localhost/api/organizations/org-a/documents") as never, context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Akses ke organisasi atau tindakan ini tidak diizinkan." });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for document finalization before reading storage when membership is denied", async () => {
    requireTenantContext.mockRejectedValue(Object.assign(new Error("Akses ke organisasi atau tindakan ini tidak diizinkan."), { name: "ForbiddenError" }));
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Akses ke organisasi atau tindakan ini tidak diizinkan." });
    expect(findUnique).not.toHaveBeenCalled();
    expect(headR2Object).not.toHaveBeenCalled();
  });

});