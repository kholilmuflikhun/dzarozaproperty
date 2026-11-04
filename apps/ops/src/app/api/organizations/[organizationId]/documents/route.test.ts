import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireTenantContext, headR2Object, isTenantDocumentKey, findMany, findUnique, create } = vi.hoisted(() => ({
  requireTenantContext: vi.fn(),
  headR2Object: vi.fn(),
  isTenantDocumentKey: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
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

vi.mock("@/lib/r2-storage", () => ({ headR2Object, isTenantDocumentKey }));
vi.mock("@dzaroza/database", () => ({
  prisma: { document: { findMany, findUnique, create } },
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
    create.mockReset();
    requireTenantContext.mockResolvedValue({ organizationId: "org-a", userId: "user-a", role: "STAFF" });
    isTenantDocumentKey.mockReturnValue(true);
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue(null);
    headR2Object.mockResolvedValue({
      contentLength: 2048,
      contentType: "application/pdf",
      etag: '"r2-etag"',
    });
    create.mockImplementation(async ({ data, select }) => ({
      id: "doc-a",
      organizationId: data.organizationId,
      fileName: data.fileName,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      etag: data.etag,
      status: data.status,
      projectId: null,
      invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"),
      ...select,
    }));
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

  it("verifies object metadata from R2 before creating an AVAILABLE document", async () => {
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(requireTenantContext).toHaveBeenCalledWith("org-a");
    expect(headR2Object).toHaveBeenCalledWith("organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-a",
        uploadedById: "user-a",
        fileName: "contract.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048n,
        status: "AVAILABLE",
      }),
    }));
    expect(body.document.sizeBytes).toBe("2048");
  });

  it("rejects object keys outside the active tenant", async () => {
    isTenantDocumentKey.mockReturnValue(false);
    const response = await POST(request({ objectKey: "organizations/org-b/documents/secret.pdf" }), context);
    expect(response.status).toBe(404);
    expect(headR2Object).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not create metadata when the object is missing from R2", async () => {
    headR2Object.mockResolvedValue(null);
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects files with unsupported content types or excessive size", async () => {
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
    expect(create).not.toHaveBeenCalled();
  });

  it("returns an existing finalized document idempotently", async () => {
    findUnique.mockResolvedValue({
      id: "doc-existing", organizationId: "org-a", fileName: "contract.pdf",
      contentType: "application/pdf", sizeBytes: 2048n, etag: '"r2-etag"',
      status: "AVAILABLE", projectId: null, invoiceId: null,
      createdAt: new Date("2026-11-04T00:00:00.000Z"), deletedAt: null,
    });
    const response = await POST(request({
      objectKey: "organizations/org-a/documents/123e4567-e89b-12d3-a456-426614174000/contract.pdf",
    }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.alreadyFinalized).toBe(true);
    expect(headR2Object).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
