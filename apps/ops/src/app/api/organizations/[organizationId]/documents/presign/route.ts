import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  createTenantDocumentKey,
  headR2Object,
  getR2Object,
  sha256Bytes,
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
    projectId: z.string().trim().min(1).max(64).optional(),
    invoiceId: z.string().trim().min(1).max(64).optional(),
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

    const actor = await requireTenantContext(organizationId);

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
      let linkedProjectId = parsed.data.projectId;
      if (parsed.data.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: parsed.data.projectId, organizationId },
          select: { id: true },
        });
        if (!project) {
          return NextResponse.json({ error: "Proyek tidak ditemukan pada organisasi ini." }, { status: 404 });
        }
      }
      if (parsed.data.invoiceId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: parsed.data.invoiceId, organizationId },
          select: {
            id: true,
            projectId: true,
            project: { select: { clientId: true } },
            quotation: { select: { clientId: true } },
          },
        });
        if (!invoice) {
          return NextResponse.json({ error: "Invoice tidak ditemukan pada organisasi ini." }, { status: 404 });
        }
        if (
          invoice.projectId
          && invoice.quotation?.clientId
          && invoice.project?.clientId !== invoice.quotation.clientId
        ) {
          return NextResponse.json({ error: "Proyek invoice tidak sesuai dengan klien pada penawaran." }, { status: 422 });
        }
        if (linkedProjectId && invoice.projectId && linkedProjectId !== invoice.projectId) {
          return NextResponse.json({ error: "Proyek dan invoice tidak saling terkait." }, { status: 422 });
        }
        if (linkedProjectId && !invoice.projectId && invoice.quotation?.clientId) {
          const project = await prisma.project.findFirst({
            where: { id: linkedProjectId, organizationId, clientId: invoice.quotation?.clientId ?? undefined },
            select: { id: true },
          });
          if (!project) {
            return NextResponse.json({ error: "Proyek tidak sesuai dengan klien invoice." }, { status: 422 });
          }
        }
        linkedProjectId = linkedProjectId ?? invoice.projectId ?? undefined;
      }

      const objectKey = createTenantDocumentKey(organizationId, parsed.data.fileName);
      const signed = await createPresignedUploadUrl(objectKey, 300, parsed.data.contentType);
      const document = await prisma.document.create({
        data: {
          organizationId,
          uploadedById: actor.userId,
          projectId: linkedProjectId,
          invoiceId: parsed.data.invoiceId,
          fileName: objectKey.split("/").at(-1) ?? "document",
          objectKey,
          contentType: parsed.data.contentType,
          sizeBytes: BigInt(parsed.data.size),
          status: "PENDING_UPLOAD",
        },
        select: { id: true },
      });
      return NextResponse.json({
        upload: {
          documentId: document.id,
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
      select: { objectKey: true, etag: true, checksumSha256: true, sizeBytes: true, contentType: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan pada organisasi ini." }, { status: 404 });
    }

    // A presigned PUT remains usable until expiry. Refuse downloads if the object
    // no longer matches the ETag captured during finalization.
    const currentObject = await getR2Object(document.objectKey, MAX_FILE_SIZE_BYTES);
    if (
      !currentObject
      || !document.etag
      || !document.checksumSha256
      || currentObject.etag !== document.etag
      || currentObject.contentLength !== Number(document.sizeBytes)
      || currentObject.contentType !== document.contentType
      || await sha256Bytes(currentObject.bytes) !== document.checksumSha256
    ) {
      return NextResponse.json({ error: "Integritas berkas tidak dapat diverifikasi. Unduhan ditahan untuk pemeriksaan." }, { status: 409 });
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
