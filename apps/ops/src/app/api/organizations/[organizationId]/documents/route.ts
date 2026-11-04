import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import { headR2Object, isTenantDocumentKey } from "@/lib/r2-storage";

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
    const actor = await requireTenantContext(organizationId);

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
        etag: true, status: true, projectId: true, invoiceId: true, createdAt: true,
      },
    });
    if (existing) {
      if (existing.organizationId !== organizationId || existing.status !== "AVAILABLE" || existing.deletedAt) {
        return NextResponse.json({ error: "Dokumen tidak dapat difinalisasi." }, { status: 409 });
      }
      return NextResponse.json({ document: serializeDocument(existing), alreadyFinalized: true });
    }

    const object = await headR2Object(objectKey);
    if (!object) {
      return NextResponse.json({ error: "Berkas belum ditemukan di penyimpanan." }, { status: 404 });
    }
    if (
      object.contentLength < 1
      || object.contentLength > MAX_FILE_SIZE_BYTES
      || !object.contentType
      || !allowedContentTypes.has(object.contentType)
    ) {
      return NextResponse.json({ error: "Metadata berkas tidak memenuhi kebijakan penyimpanan." }, { status: 422 });
    }

    const fileName = objectKey.split("/").at(-1) ?? "document";
    const document = await prisma.document.create({
      data: {
        organizationId,
        uploadedById: actor.userId,
        fileName,
        objectKey,
        contentType: object.contentType,
        sizeBytes: BigInt(object.contentLength),
        etag: object.etag,
        status: "AVAILABLE",
      },
      select: {
        id: true, organizationId: true, fileName: true, contentType: true, sizeBytes: true,
        etag: true, status: true, projectId: true, invoiceId: true, createdAt: true,
      },
    });
    return NextResponse.json({ document: serializeDocument(document) }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ error: "Dokumen sudah terdaftar." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
