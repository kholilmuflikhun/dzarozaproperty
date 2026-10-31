import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const paymentSchema = z.object({
  invoiceId: z.string().trim().min(1).max(64),
  amount: z.number().finite().positive().max(999_999_999_999).multipleOf(0.01),
  paidAt: z.string().datetime().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: "Limit harus antara 1 dan 100." }, { status: 400 });
    const rows = await prisma.paymentTransaction.findMany({
      where: { organizationId, invoiceId: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit,
      include: { invoice: { select: { id: true, number: true, total: true } } },
    });
    return NextResponse.json({ payments: rows });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.FINANCE]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data pembayaran tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { organizationId, id: input.invoiceId } });
      if (!invoice) return { kind: "not-found" as const };
      if (!["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) return { kind: "invoice-locked" as const };
      const remaining = invoice.total.minus(invoice.paidAmount);
      if (amount.greaterThan(remaining) || amount.lessThanOrEqualTo(0)) return { kind: "overpayment" as const, remaining: remaining.toString() };
      const newPaidAmount = invoice.paidAmount.plus(amount).toDecimalPlaces(2);
      const newStatus = newPaidAmount.greaterThanOrEqualTo(invoice.total) ? "PAID" : "PARTIALLY_PAID";
      const changed = await tx.invoice.updateMany({
        where: { organizationId, id: invoice.id, paidAmount: invoice.paidAmount, status: invoice.status },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });
      if (changed.count !== 1) return { kind: "conflict" as const };
      const payment = await tx.paymentTransaction.create({
        data: {
          organizationId, invoiceId: invoice.id, provider: "MANUAL",
          providerRef: `MANUAL-${randomUUID()}`, amount, currency: "IDR",
          status: "SETTLEMENT", paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "payment.recorded",
          entityType: "PaymentTransaction", entityId: payment.id,
          afterState: { invoiceId: invoice.id, invoiceNumber: invoice.number, amount: amount.toString(), status: payment.status, note: input.note ?? null },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "invoice.payment_applied",
          entityType: "Invoice", entityId: invoice.id,
          beforeState: { paidAmount: invoice.paidAmount.toString(), status: invoice.status },
          afterState: { paidAmount: newPaidAmount.toString(), status: newStatus },
        },
      });
      return { kind: "created" as const, payment, invoice: { id: invoice.id, number: invoice.number, total: invoice.total, paidAmount: newPaidAmount, status: newStatus } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (result.kind === "invoice-locked") return NextResponse.json({ error: "Pembayaran hanya dapat dicatat untuk invoice yang sudah diterbitkan dan belum lunas." }, { status: 409 });
    if (result.kind === "overpayment") return NextResponse.json({ error: "Nominal pembayaran melebihi sisa tagihan.", remaining: result.remaining }, { status: 400 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Invoice berubah bersamaan. Muat ulang sebelum mencatat pembayaran." }, { status: 409 });
    return NextResponse.json({ payment: result.payment, invoice: result.invoice }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Transaksi bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
