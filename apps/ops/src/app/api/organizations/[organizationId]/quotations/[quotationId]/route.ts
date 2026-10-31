import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const itemSchema = z.object({
  description: z.string().trim().min(2).max(500),
  quantity: z.number().finite().positive().max(10_000).multipleOf(0.001),
  unitPrice: z.number().finite().min(0).max(100_000_000).multipleOf(0.01),
});
const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    clientId: z.string().trim().min(1).max(64).optional(),
    projectId: z.string().trim().min(1).max(64).nullable().optional(),
    items: z.array(itemSchema).min(1).max(100),
    discount: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
    tax: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
  }),
  z.object({ action: z.literal("send") }),
]);
class PayloadTooLargeError extends Error {}

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

function validIds(organizationId: string, quotationId: string) {
  return organizationId.length > 0 && organizationId.length <= 64 && quotationId.length > 0 && quotationId.length <= 64;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; quotationId: string }> }) {
  try {
    const { organizationId, quotationId } = await context.params;
    if (!validIds(organizationId, quotationId)) {
      return NextResponse.json({ error: "ID organisasi atau quotation tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const quotation = await prisma.quotation.findFirst({
      where: { organizationId, id: quotationId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, code: true, name: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!quotation) return NextResponse.json({ error: "Quotation tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ quotation });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ organizationId: string; quotationId: string }> }) {
  try {
    const { organizationId, quotationId } = await context.params;
    if (!validIds(organizationId, quotationId)) {
      return NextResponse.json({ error: "ID organisasi atau quotation tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER, MembershipRole.SALES,
    ]);
    let body: unknown;
    try {
      body = await readJson(request);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof PayloadTooLargeError ? "Payload terlalu besar." : "Payload JSON tidak valid." },
        { status: error instanceof PayloadTooLargeError ? 413 : 400 },
      );
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data perubahan quotation tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.quotation.findFirst({
        where: { organizationId, id: quotationId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!current) return { kind: "not-found" as const };
      if (current.status !== "DRAFT") return { kind: "locked" as const };

      if (parsed.data.action === "send") {
        const changed = await tx.quotation.updateMany({
          where: { organizationId, id: quotationId, status: "DRAFT" },
          data: { status: "SENT", issuedAt: new Date() },
        });
        if (changed.count !== 1) return { kind: "locked" as const };
      } else {
        const input = parsed.data;
        const clientId = input.clientId ?? current.clientId;
        const projectId = input.projectId === undefined ? current.projectId : input.projectId;
        const client = await tx.client.findUnique({
          where: { organizationId_id: { organizationId, id: clientId } },
          select: { id: true },
        });
        if (!client) return { kind: "client-not-found" as const };
        if (projectId) {
          const project = await tx.project.findUnique({
            where: { organizationId_id: { organizationId, id: projectId } },
            select: { id: true, clientId: true },
          });
          if (!project || project.clientId !== clientId) return { kind: "project-not-found" as const };
        }

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
          return { kind: "amount-invalid" as const };
        }
        if (discount.greaterThan(subtotal)) return { kind: "discount-invalid" as const };
        const total = subtotal.minus(discount).plus(tax).toDecimalPlaces(2);
        if (total.lessThan(0) || total.greaterThan("999999999999.99")) return { kind: "amount-invalid" as const };

        const changed = await tx.quotation.updateMany({
          where: { organizationId, id: quotationId, status: "DRAFT" },
          data: { clientId, projectId, subtotal, discount, tax, total },
        });
        if (changed.count !== 1) return { kind: "locked" as const };
        await tx.quotationItem.deleteMany({ where: { organizationId, quotationId } });
        await tx.quotationItem.createMany({
          data: items.map((item) => ({ ...item, organizationId, quotationId })),
        });
      }

      const quotation = await tx.quotation.findFirst({
        where: { organizationId, id: quotationId },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          project: { select: { id: true, code: true, name: true, status: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!quotation) return { kind: "not-found" as const };
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: parsed.data.action === "send" ? "quotation.sent" : "quotation.updated",
          entityType: "Quotation",
          entityId: quotationId,
          beforeState: { status: current.status, number: current.number, total: current.total.toString() },
          afterState: { status: quotation.status, number: quotation.number, total: quotation.total.toString() },
        },
      });
      return { kind: "updated" as const, quotation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "not-found") return NextResponse.json({ error: "Quotation tidak ditemukan." }, { status: 404 });
    if (result.kind === "locked") return NextResponse.json({ error: "Quotation tidak dapat diubah karena statusnya bukan DRAFT." }, { status: 409 });
    if (result.kind === "client-not-found") return NextResponse.json({ error: "Klien tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (result.kind === "project-not-found") return NextResponse.json({ error: "Proyek tidak ditemukan atau bukan milik klien ini." }, { status: 404 });
    if (result.kind === "discount-invalid") return NextResponse.json({ error: "Diskon tidak boleh melebihi subtotal." }, { status: 400 });
    if (result.kind === "amount-invalid") return NextResponse.json({ error: "Nilai quotation berada di luar batas nominal yang diizinkan." }, { status: 400 });
    return NextResponse.json({ quotation: result.quotation });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
