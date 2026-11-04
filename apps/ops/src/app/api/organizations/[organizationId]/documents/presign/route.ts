import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  createTenantDocumentKey,
} from "@/lib/r2-storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const allowedContentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upload"),
    fileName: z.string().trim().min(1).max(180),
    contentType: z.enum(allowedContentTypes),
    size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  }),
  z.object({
    action: z.literal("download"),
    documentId: z.string().trim().min(1).max(64),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
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

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Permintaan dokumen tidak valid.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.action === "upload") {
      const objectKey = createTenantDocumentKey(organizationId, parsed.data.fileName);
      const signed = await createPresignedUploadUrl(objectKey, 300, parsed.data.contentType);
      return NextResponse.json({
        upload: {
          method: signed.method,
          url: signed.url,
          objectKey,
          expiresIn: signed.expiresIn,
          headers: signed.headers ?? {},
          maxSizeBytes: MAX_FILE_SIZE_BYTES,
        },
      });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: parsed.data.documentId,
        organizationId,
        status: "AVAILABLE",
        deletedAt: null,
      },
      select: { objectKey: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan pada organisasi ini." }, { status: 404 });
    }

    const signed = await createPresignedDownloadUrl(document.objectKey, 300);
    return NextResponse.json({
      download: {
        method: signed.method,
        url: signed.url,
        expiresIn: signed.expiresIn,
      },
    });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
