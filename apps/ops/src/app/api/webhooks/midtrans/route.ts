import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { verifyMidtransSignature, isSuccessfulMidtransPayment, canApplyPaymentStatus, storedMidtransPaymentStatus } from "@/lib/midtrans";

const payloadSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1),
  gross_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  signature_key: z.string().min(1),
  transaction_id: z.string().min(1).max(100),
  transaction_status: z.string().min(1).max(40),
  fraud_status: z.string().optional(),
  currency: z.string().optional(),
});

function addPeriod(start: Date, cycle: "MONTHLY" | "YEARLY") {
  const end = new Date(start);
  if (cycle === "MONTHLY") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end;
}

export async function POST(request: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return NextResponse.json({ error: "Webhook belum dikonfigurasi." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Payload webhook tidak valid." }, { status: 400 });
  const payload = parsed.data;
  if (!verifyMidtransSignature(payload, serverKey)) return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  if (payload.currency && payload.currency !== "IDR") return NextResponse.json({ error: "Mata uang tidak didukung." }, { status: 400 });

  const subscription = await prisma.subscription.findUnique({ where: { providerOrderId: payload.order_id }, include: { plan: true } });
  if (!subscription) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  if (subscription.status === "CANCELED" || subscription.status === "EXPIRED") return NextResponse.json({ error: "Langganan ini sudah ditutup." }, { status: 409 });
  const expectedAmount = subscription.billingCycle === "MONTHLY" ? subscription.plan.monthlyPrice : subscription.plan.yearlyPrice;
  if (!new Prisma.Decimal(payload.gross_amount).equals(expectedAmount)) return NextResponse.json({ error: "Nominal pembayaran tidak cocok." }, { status: 400 });

  // fraud_status is part of the event identity: Midtrans may re-notify the same
  // capture transaction when a challenge is later accepted.
  const eventId = `${payload.order_id}:${payload.transaction_id}:${payload.transaction_status}:${payload.fraud_status ?? "none"}`;
  const now = new Date();
  const successful = isSuccessfulMidtransPayment(payload);
  const terminalFailure = ["expire", "deny", "cancel"].includes(payload.transaction_status);
  const paymentStatus = storedMidtransPaymentStatus(payload);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingEvent.create({
        data: { subscriptionId: subscription.id, provider: "MIDTRANS", providerEventId: eventId, eventType: payload.transaction_status, payload: payload as Prisma.InputJsonValue, processedAt: now },
      });
      const existingPayment = await tx.paymentTransaction.findUnique({ where: { providerRef: payload.transaction_id } });
      if (existingPayment && (existingPayment.subscriptionId !== subscription.id || existingPayment.organizationId !== subscription.organizationId)) {
        throw new Error("PAYMENT_REFERENCE_CONFLICT");
      }
      if (!existingPayment) {
        await tx.paymentTransaction.create({
          data: {
            organizationId: subscription.organizationId,
            subscriptionId: subscription.id,
            provider: "MIDTRANS",
            providerRef: payload.transaction_id,
            amount: new Prisma.Decimal(payload.gross_amount),
            currency: "IDR",
            status: paymentStatus,
            paidAt: successful ? now : null,
          },
        });
      } else if (canApplyPaymentStatus(existingPayment.status, payload.transaction_status, payload.fraud_status)) {
        await tx.paymentTransaction.update({
          where: { id: existingPayment.id },
          data: {
            status: paymentStatus,
            paidAt: successful ? existingPayment.paidAt ?? now : existingPayment.paidAt,
          },
        });
      }
      if (successful) {
        const periodEnd = addPeriod(now, subscription.billingCycle);
        const changed = await tx.subscription.updateMany({
          where: { id: subscription.id, status: { in: ["INCOMPLETE", "PAST_DUE", "ACTIVE"] } },
          data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
        });
        if (changed.count !== 1) throw new Error("SUBSCRIPTION_STATE_CONFLICT");
        await tx.license.updateMany({ where: { subscriptionId: subscription.id, status: "ACTIVE" }, data: { expiresAt: periodEnd } });
        await tx.auditLog.create({
          data: { organizationId: subscription.organizationId, action: "subscription.payment_confirmed", entityType: "Subscription", entityId: subscription.id, metadata: { provider: "MIDTRANS", transactionId: payload.transaction_id, periodEnd: periodEnd.toISOString() } },
        });
      } else if (terminalFailure) {
        await tx.subscription.updateMany({
          where: { id: subscription.id, status: "INCOMPLETE" },
          data: { status: payload.transaction_status === "cancel" ? "CANCELED" : "EXPIRED" },
        });
        await tx.license.updateMany({ where: { subscriptionId: subscription.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    if (error instanceof Error && error.message === "SUBSCRIPTION_STATE_CONFLICT") return NextResponse.json({ error: "Status langganan berubah sebelum pembayaran diproses." }, { status: 409 });
    if (error instanceof Error && error.message === "PAYMENT_REFERENCE_CONFLICT") return NextResponse.json({ error: "Referensi pembayaran sudah digunakan pada order lain." }, { status: 409 });
    return NextResponse.json({ error: "Webhook belum dapat diproses." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
