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
const createSchema = z.object({
  projectId: z.string().trim().min(1).max(64).optional(),
  quotationId: z.string().trim().min(1).max(64).optional(),
  items: z.array(itemSchema).min(1).max(100).optional(),
  discount: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
  tax: z.number().finite().min(0).max(999_999_999_999).optional().default(0),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((value) => Boolean(value.quotationId || value.projectId), { message: "Pilih quotation atau proyek." })
  .refine((value) => Boolean(value.quotationId) || Boolean(value.items?.length), { message: "Item invoice wajib diisi." });

const MAX_AMOUNT = new Prisma.Decimal("999999999999.99");

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: "Limit harus antara 1 dan 100." }, { status: 400 });
    const status = url.searchParams.get("status");
    if (status && !["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].includes(status)) return NextResponse.json({ error: "Status invoice tidak valid." }, { status: 400 });
    const cursor = url.searchParams.get("cursor");
    if (cursor && cursor.length > 64) return NextResponse.json({ error: "Cursor tidak valid." }, { status: 400 });
    const rows = await prisma.invoice.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        project: { select: { id: true, code: true, name: true, client: { select: { id: true, name: true } } } },
        quotation: { select: { id: true, number: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const invoices = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json({ invoices, pagination: { limit, hasMore, nextCursor: hasMore ? invoices[invoices.length - 1]?.id ?? null : null } });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.FINANCE, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data invoice tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      let projectId = input.projectId ?? null;
      let items: { description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal; sortOrder: number }[];
      let subtotal: Prisma.Decimal;
      let discount: Prisma.Decimal;
      let tax: Prisma.Decimal;
      if (input.quotationId) {
        const quotation = await tx.quotation.findFirst({
          where: { organizationId, id: input.quotationId, status: { in: ["ACCEPTED", "CONVERTED"] } },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        });
        if (!quotation) return { kind: "quotation-not-found" as const };
        if (quotation.projectId) {
          if (projectId && projectId !== quotation.projectId) return { kind: "project-mismatch" as const };
          projectId = quotation.projectId;
        } else if (projectId) {
          const project = await tx.project.findFirst({
            where: { organizationId, id: projectId, clientId: quotation.clientId },
            select: { id: true },
          });
          if (!project) return { kind: "project-mismatch" as const };
        }
        items = quotation.items.map((item) => ({
          description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
          lineTotal: item.lineTotal, sortOrder: item.sortOrder,
        }));
        subtotal = quotation.subtotal; discount = quotation.discount; tax = quotation.tax;
      } else {
        const project = await tx.project.findFirst({ where: { organizationId, id: projectId! }, select: { id: true } });
        if (!project) return { kind: "project-not-found" as const };
        items = (input.items ?? []).map((item, index) => {
          const quantity = new Prisma.Decimal(item.quantity);
          const unitPrice = new Prisma.Decimal(item.unitPrice);
          return { description: item.description, quantity, unitPrice, lineTotal: quantity.mul(unitPrice).toDecimalPlaces(2), sortOrder: index };
        });
        subtotal = items.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
        discount = new Prisma.Decimal(input.discount).toDecimalPlaces(2);
        tax = new Prisma.Decimal(input.tax).toDecimalPlaces(2);
      }
      if (!items.length || subtotal.greaterThan(MAX_AMOUNT) || discount.greaterThan(MAX_AMOUNT) || tax.greaterThan(MAX_AMOUNT) || discount.greaterThan(subtotal)) return { kind: "amount-invalid" as const };
      const total = subtotal.minus(discount).plus(tax).toDecimalPlaces(2);
      if (total.lessThanOrEqualTo(0) || total.greaterThan(MAX_AMOUNT)) return { kind: "amount-invalid" as const };
      const number = `INV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomUUID().slice(0,8).toUpperCase()}`;
      const invoice = await tx.invoice.create({
        data: {
          organizationId, projectId, quotationId: input.quotationId ?? null, number,
          status: "DRAFT", subtotal, discount, tax, total, paidAmount: new Prisma.Decimal(0),
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          items: { create: items },
        },
        include: { items: { orderBy: { sortOrder: "asc" } }, project: { select: { id: true, code: true, name: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "invoice.created",
          entityType: "Invoice", entityId: invoice.id,
          afterState: { number, projectId, quotationId: input.quotationId ?? null, subtotal: subtotal.toString(), discount: discount.toString(), tax: tax.toString(), total: total.toString() },
        },
      });
      return { kind: "created" as const, invoice };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "quotation-not-found") return NextResponse.json({ error: "Quotation ACCEPTED/CONVERTED tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (result.kind === "project-not-found") return NextResponse.json({ error: "Proyek tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (result.kind === "project-mismatch") return NextResponse.json({ error: "Proyek tidak sesuai dengan quotation." }, { status: 409 });
    if (result.kind === "amount-invalid") return NextResponse.json({ error: "Item atau nominal invoice tidak valid." }, { status: 400 });
    return NextResponse.json({ invoice: result.invoice }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Invoice untuk quotation ini sudah ada atau nomor invoice duplikat." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
