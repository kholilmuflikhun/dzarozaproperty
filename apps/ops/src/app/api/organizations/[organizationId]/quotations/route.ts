import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const itemSchema = z.object({
  description: z.string().trim().min(2).max(500),
  quantity: z.number().finite().positive().max(10_000).multipleOf(0.001),
  unitPrice: z.number().finite().min(0).max(100_000_000).multipleOf(0.01),
});
const quotationSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  projectId: z.string().trim().min(1).max(64).nullable().optional(),
  items: z.array(itemSchema).min(1).max(100),
  discount: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
  tax: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
});

async function readJson(request: NextRequest, limit = 32_768): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > limit) throw new PayloadTooLargeError();
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
class PayloadTooLargeError extends Error {}

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Parameter limit harus antara 1 dan 100." }, { status: 400 });
    }
    const status = url.searchParams.get("status");
    if (status && !["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"].includes(status)) {
      return NextResponse.json({ error: "Status quotation tidak valid." }, { status: 400 });
    }
    const cursor = url.searchParams.get("cursor");
    if (cursor && cursor.length > 64) {
      return NextResponse.json({ error: "Cursor quotation tidak valid." }, { status: 400 });
    }
    const rows = await prisma.quotation.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const quotations = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json({
      quotations,
      pagination: { limit, hasMore, nextCursor: hasMore ? quotations[quotations.length - 1]?.id ?? null : null },
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
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER, MembershipRole.SALES,
    ]);
    let body: unknown;
    try {
      body = await readJson(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
      }
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const parsed = quotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data quotation tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }
    const input = parsed.data;
    const items = input.items.map((item, index) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2);
      return { description: item.description, quantity, unitPrice, lineTotal, sortOrder: index };
    });
    const subtotal = items.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const discount = new Prisma.Decimal(input.discount).toDecimalPlaces(2);
    const tax = new Prisma.Decimal(input.tax).toDecimalPlaces(2);
    if (subtotal.greaterThan("999999999999.99") || discount.greaterThan("999999999999.99") || tax.greaterThan("999999999999.99")) {
      return NextResponse.json({ error: "Nilai quotation melebihi kapasitas nominal yang diizinkan." }, { status: 400 });
    }
    if (discount.greaterThan(subtotal)) {
      return NextResponse.json({ error: "Diskon tidak boleh melebihi subtotal." }, { status: 400 });
    }
    const total = subtotal.minus(discount).plus(tax).toDecimalPlaces(2);
    if (total.lessThan(0) || total.greaterThan("999999999999.99")) {
      return NextResponse.json({ error: "Total quotation berada di luar batas yang diizinkan." }, { status: 400 });
    }
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const number = `QT-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { organizationId_id: { organizationId, id: input.clientId } },
        select: { id: true },
      });
      if (!client) return { kind: "client-not-found" as const };
      if (input.projectId) {
        const project = await tx.project.findUnique({
          where: { organizationId_id: { organizationId, id: input.projectId } },
          select: { id: true, clientId: true },
        });
        if (!project || project.clientId !== input.clientId) return { kind: "project-not-found" as const };
      }
      const quotation = await tx.quotation.create({
        data: {
          organizationId,
          clientId: input.clientId,
          projectId: input.projectId ?? null,
          number,
          status: "DRAFT",
          subtotal,
          discount,
          tax,
          total,
          items: { create: items },
        },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, code: true, name: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "quotation.created",
          entityType: "Quotation",
          entityId: quotation.id,
          afterState: {
            number: quotation.number,
            clientId: quotation.clientId,
            projectId: quotation.projectId,
            subtotal: subtotal.toString(),
            discount: discount.toString(),
            tax: tax.toString(),
            total: total.toString(),
            itemCount: items.length,
          },
        },
      });
      return { kind: "created" as const, quotation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "client-not-found") {
      return NextResponse.json({ error: "Klien tidak ditemukan pada organisasi ini." }, { status: 404 });
    }
    if (result.kind === "project-not-found") {
      return NextResponse.json({ error: "Proyek tidak ditemukan atau bukan milik klien ini." }, { status: 404 });
    }
    return NextResponse.json({ quotation: result.quotation }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ error: "Nomor quotation sudah digunakan. Silakan coba kembali." }, { status: 409 });
    }
    if (code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
