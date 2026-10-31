import { randomUUID } from "node:crypto";
import midtransClient from "midtrans-client";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

function getSnapClient() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  if (!serverKey || !clientKey) return null;
  return new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey,
    clientKey,
  });
}

export async function POST(_request: NextRequest, context: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  try {
    const { organizationId, invoiceId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !invoiceId || invoiceId.length > 64) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.FINANCE,
    ]);
    const snap = getSnapClient();
    if (!snap) return NextResponse.json({ error: "Payment gateway belum dikonfigurasi." }, { status: 503 });

    const prepared = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { organizationId, id: invoiceId },
        include: {
          project: { include: { client: { select: { name: true, email: true, phone: true } } } },
          quotation: { include: { client: { select: { name: true, email: true, phone: true } } } },
        },
      });
      if (!invoice) return { kind: "not-found" as const };
      if (!["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) return { kind: "locked" as const };
      const remaining = invoice.total.minus(invoice.paidAmount).toDecimalPlaces(2);
      if (!remaining.greaterThan(0) || !remaining.isInteger()) return { kind: "amount-invalid" as const };
      const existing = await tx.paymentTransaction.findFirst({
        where: { organizationId, invoiceId, provider: "MIDTRANS", status: "PENDING", providerOrderId: { not: null }, createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
      });
      if (existing?.checkoutToken && existing.checkoutUrl) {
        return { kind: "existing" as const, paymentId: existing.id, orderId: existing.providerOrderId!, token: existing.checkoutToken, redirectUrl: existing.checkoutUrl };
      }
      if (existing) return { kind: "checkout-pending" as const };
      const orderId = `DZINV-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
      const payment = await tx.paymentTransaction.create({
        data: {
          organizationId, invoiceId, provider: "MIDTRANS", providerOrderId: orderId,
          amount: remaining, currency: "IDR", status: "PENDING",
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "invoice.payment_checkout_created",
          entityType: "Invoice", entityId: invoiceId,
          metadata: { paymentId: payment.id, orderId, amount: remaining.toString(), provider: "MIDTRANS" },
        },
      });
      const client = invoice.project?.client ?? invoice.quotation?.client;
      return { kind: "created" as const, paymentId: payment.id, orderId, amount: remaining.toNumber(), invoiceNumber: invoice.number, client };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (prepared.kind === "not-found") return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (prepared.kind === "locked") return NextResponse.json({ error: "Checkout hanya tersedia untuk invoice yang telah diterbitkan dan belum lunas." }, { status: 409 });
    if (prepared.kind === "amount-invalid") return NextResponse.json({ error: "Sisa tagihan harus berupa nominal IDR bulat dan lebih besar dari nol." }, { status: 422 });
    if (prepared.kind === "checkout-pending") return NextResponse.json({ error: "Checkout pembayaran sedang dibuat. Silakan coba kembali beberapa saat." }, { status: 409 });
    if (prepared.kind === "existing") return NextResponse.json({ paymentId: prepared.paymentId, orderId: prepared.orderId, snapToken: prepared.token, redirectUrl: prepared.redirectUrl, reused: true });

    try {
      const customer = prepared.client;
      const transaction = await snap.createTransaction({
        transaction_details: { order_id: prepared.orderId, gross_amount: prepared.amount },
        customer_details: {
          first_name: (customer?.name ?? "Pelanggan").slice(0, 50),
          ...(customer?.email ? { email: customer.email } : {}),
          ...(customer?.phone ? { phone: customer.phone } : {}),
        },
        item_details: [{
          id: prepared.invoiceNumber.slice(0, 50),
          price: prepared.amount,
          quantity: 1,
          name: `Pembayaran invoice ${prepared.invoiceNumber}`.slice(0, 50),
        }],
      });
      await prisma.paymentTransaction.update({
        where: { id: prepared.paymentId },
        data: { checkoutToken: transaction.token, checkoutUrl: transaction.redirect_url },
      });
      return NextResponse.json({
        paymentId: prepared.paymentId, orderId: prepared.orderId,
        snapToken: transaction.token, redirectUrl: transaction.redirect_url,
      }, { status: 201, headers: { "cache-control": "no-store" } });
    } catch {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.updateMany({
          where: { id: prepared.paymentId, status: "PENDING" },
          data: { status: "FAILED" },
        });
        await tx.auditLog.create({
          data: {
            organizationId, actorId: actor.userId, action: "invoice.payment_checkout_failed",
            entityType: "Invoice", entityId: invoiceId,
            metadata: { paymentId: prepared.paymentId, provider: "MIDTRANS" },
          },
        });
      });
      return NextResponse.json({ error: "Checkout Midtrans gagal dibuat. Silakan coba kembali." }, { status: 502 });
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Checkout pembayaran lain sedang diproses." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
