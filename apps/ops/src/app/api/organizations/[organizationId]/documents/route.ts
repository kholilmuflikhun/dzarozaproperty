import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import { getR2Object, headR2Object, isTenantDocumentKey, sha256Bytes } from "@/lib/r2-storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const allowedContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const finalizeSchema = z.object({
  objectKey: z.string().min(1).max(1024),
}).strict();


function hasValidFileSignature(contentType: string, bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  switch (contentType) {
    case "application/pdf":
      return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8
        && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
    case "image/webp":
      return bytes.length >= 12
        && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF"
        && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
    case "text/csv":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return text.length > 0 && !text.includes("\\0");
      } catch {
        return false;
      }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      // OOXML documents are ZIP containers; deeper archive/package validation is a separate layer.
      return bytes[0] === 0x50 && bytes[1] === 0x4b
        && [0x03, 0x05, 0x07].includes(bytes[2])
        && [0x04, 0x06, 0x08].includes(bytes[3]);
    default:
      return false;
  }
}

function serializeDocument<T extends { sizeBytes: bigint }>(document: T) {
  return { ...document, sizeBytes: document.sizeBytes.toString() };
}

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const cursor = url.searchParams.get("cursor");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Limit harus antara 1 dan 100." }, { status: 400 });
    }
    if (cursor && (cursor.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
      return NextResponse.json({ error: "Cursor tidak valid." }, { status: 400 });
    }

    const rows = await prisma.document.findMany({
      where: { organizationId, status: "AVAILABLE", deletedAt: null },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, fileName: true, contentType: true, sizeBytes: true, etag: true,
        status: true, projectId: true, invoiceId: true, createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const documents = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json({
      documents: documents.map(serializeDocument),
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore ? documents[documents.length - 1]?.id ?? null : null,
      },
    });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Permintaan finalisasi dokumen tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { objectKey } = parsed.data;
    if (!isTenantDocumentKey(organizationId, objectKey)) {
      return NextResponse.json({ error: "Objek tidak ditemukan pada organisasi ini." }, { status: 404 });
    }

    const existing = await prisma.document.findUnique({
      where: { objectKey },
      select: {
        id: true, organizationId: true, fileName: true, contentType: true, sizeBytes: true,
        etag: true, status: true, projectId: true, invoiceId: true, createdAt: true, deletedAt: true,
      },
    });
    if (!existing || existing.organizationId !== organizationId || existing.deletedAt) {
      return NextResponse.json({ error: "Sesi unggah dokumen tidak ditemukan." }, { status: 404 });
    }
    if (existing.status === "AVAILABLE") {
      const currentObject = await getR2Object(objectKey, MAX_FILE_SIZE_BYTES);
      if (
        !currentObject
        || !existing.etag
        || !existing.checksumSha256
        || currentObject.etag !== existing.etag
        || currentObject.contentLength !== Number(existing.sizeBytes)
        || currentObject.contentType !== existing.contentType
        || await sha256Bytes(currentObject.bytes) !== existing.checksumSha256
      ) {
        return NextResponse.json({ error: "Integritas berkas berubah setelah finalisasi. Dokumen ditahan untuk pemeriksaan." }, { status: 409 });
      }
      return NextResponse.json({ document: serializeDocument(existing), alreadyFinalized: true });
    }
    if (existing.status !== "PENDING_UPLOAD") {
      return NextResponse.json({ error: "Dokumen tidak dapat difinalisasi." }, { status: 409 });
    }

    const object = await headR2Object(objectKey);
    if (!object) {
      return NextResponse.json({ error: "Berkas belum ditemukan di penyimpanan." }, { status: 404 });
    }
    if (
      object.contentLength < 1
      || object.contentLength > MAX_FILE_SIZE_BYTES
      || object.contentLength !== Number(existing.sizeBytes)
      || !object.contentType
      || !allowedContentTypes.has(object.contentType)
      || object.contentType !== existing.contentType
    ) {
      return NextResponse.json({ error: "Metadata berkas tidak sesuai dengan permintaan unggah." }, { status: 422 });
    }

    const bodyObject = await getR2Object(objectKey, MAX_FILE_SIZE_BYTES);
    if (
      !bodyObject
      || bodyObject.contentLength !== object.contentLength
      || bodyObject.contentType !== object.contentType
      || bodyObject.etag !== object.etag
    ) {
      return NextResponse.json({ error: "Isi berkas berubah saat proses verifikasi. Finalisasi ditolak." }, { status: 409 });
    }
    if (!hasValidFileSignature(existing.contentType, bodyObject.bytes)) {
      return NextResponse.json({ error: "Signature isi berkas tidak sesuai dengan format yang dipilih." }, { status: 422 });
    }
    const checksumSha256 = await sha256Bytes(bodyObject.bytes);

    // Compare-and-set prevents two concurrent finalizers from overwriting metadata.
    const finalized = await prisma.document.updateMany({
      where: {
        id: existing.id,
        organizationId,
        status: "PENDING_UPLOAD",
        deletedAt: null,
      },
      data: { status: "AVAILABLE", etag: object.etag, checksumSha256 },
    });

    const document = await prisma.document.findUnique({
      where: { id: existing.id },
      select: {
        id: true, organizationId: true, fileName: true, contentType: true, sizeBytes: true,
        etag: true, status: true, projectId: true, invoiceId: true, createdAt: true, deletedAt: true,
      },
    });
    if (
      !document
      || document.organizationId !== organizationId
      || document.deletedAt
      || document.status !== "AVAILABLE"
      || document.etag !== object.etag
      || document.checksumSha256 !== checksumSha256
    ) {
      return NextResponse.json({ error: "Status dokumen berubah selama finalisasi. Silakan ulangi pemeriksaan." }, { status: 409 });
    }
    return NextResponse.json(
      { document: serializeDocument(document), ...(finalized.count === 0 ? { alreadyFinalized: true } : {}) },
      { status: finalized.count === 1 ? 201 : 200 },
    );
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ error: "Dokumen sudah terdaftar." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
