import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import midtransClient from "midtrans-client";
import { z } from "zod";
import { prisma, Prisma, MembershipRole } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";
import { createLicenseSecret, hashLicenseSecret } from "@/lib/licensing";

const schema = z.object({ planCode: z.string().min(2).max(40), billingCycle: z.enum(["MONTHLY", "YEARLY"]) });
const MAX_CHECKOUT_BODY_BYTES = 8_192;

type LimitedJsonResult =
  | { kind: "ok"; value: unknown }
  | { kind: "too-large" }
  | { kind: "invalid" };

async function readLimitedJson(request: NextRequest): Promise<LimitedJsonResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_CHECKOUT_BODY_BYTES) return { kind: "too-large" };
  const reader = request.body?.getReader();
  if (!reader) return { kind: "invalid" };
  let totalBytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_CHECKOUT_BODY_BYTES) {
        await reader.cancel();
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { kind: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
}

function getSnapClient() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  if (!serverKey || !clientKey) return null;
  return new midtransClient.Snap({ isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true", serverKey, clientKey });
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    const membership = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const snap = getSnapClient();
    if (!snap) return NextResponse.json({ error: "Payment gateway belum dikonfigurasi." }, { status: 503 });
    const body = await readLimitedJson(request);
    if (body.kind === "too-large") return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
    if (body.kind === "invalid") return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Paket atau siklus pembayaran tidak valid." }, { status: 400 });

    const [organization, plan] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.plan.findUnique({ where: { code: parsed.data.planCode } }),
    ]);
    if (!organization) return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
    if (!plan || !plan.isActive) return NextResponse.json({ error: "Paket tidak tersedia." }, { status: 404 });

    const price = parsed.data.billingCycle === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice;
    if (!price.greaterThan(0) || !price.isInteger()) return NextResponse.json({ error: "Harga paket harus berupa nominal IDR bulat dan lebih besar dari nol." }, { status: 422 });
    const orderId = `DZOS-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
    const licenseKey = createLicenseSecret();
    let subscription;
    try {
      subscription = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const existing = await tx.subscription.findFirst({
          where: {
            organizationId,
            OR: [
              { status: "INCOMPLETE" },
              { status: "PAST_DUE" },
              { status: "ACTIVE", currentPeriodEnd: { gt: now } },
              { status: "TRIALING", currentPeriodEnd: { gt: now } },
            ],
          },
          select: { id: true },
        });
        if (existing) throw new Error("SUBSCRIPTION_ALREADY_EXISTS");

        const created = await tx.subscription.create({
          data: { organizationId, planId: plan.id, billingCycle: parsed.data.billingCycle, checkoutAmount: price, provider: "MIDTRANS", providerOrderId: orderId },
        });
        await tx.license.create({
          data: { organizationId, subscriptionId: created.id, keyHash: hashLicenseSecret(licenseKey), keyPrefix: licenseKey.slice(0, 14), maxActivations: plan.maxActivations },
        });
        await tx.auditLog.create({
          data: { organizationId, actorId: membership.userId, action: "subscription.checkout_created", entityType: "Subscription", entityId: created.id, metadata: { planCode: plan.code, billingCycle: parsed.data.billingCycle, orderId, checkoutAmount: price.toString() } },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Error && error.message === "SUBSCRIPTION_ALREADY_EXISTS") {
        return NextResponse.json({ error: "Organisasi masih memiliki langganan aktif atau checkout yang belum selesai." }, { status: 409 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return NextResponse.json({ error: "Checkout lain sedang diproses. Silakan periksa status langganan lalu coba kembali." }, { status: 409 });
      }
      throw error;
    }

    try {
      const transaction = await snap.createTransaction({
        transaction_details: { order_id: orderId, gross_amount: price.toNumber() },
        customer_details: { first_name: organization.name.slice(0, 50) },
        item_details: [{ id: plan.code, price: price.toNumber(), quantity: 1, name: `Dzaroza OS ${plan.name} ${parsed.data.billingCycle}`.slice(0, 50) }],
      });
      return NextResponse.json({ subscriptionId: subscription.id, orderId, snapToken: transaction.token, redirectUrl: transaction.redirect_url, licenseKey, licenseNotice: "Simpan license key ini sekarang. Kunci hanya ditampilkan satu kali; akses SaaS tetap memerlukan akun pengguna dan membership." }, { status: 201 });
    } catch {
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED" } }),
        prisma.license.updateMany({ where: { subscriptionId: subscription.id }, data: { status: "REVOKED" } }),
      ]);
      return NextResponse.json({ error: "Checkout gagal dibuat. Silakan coba kembali." }, { status: 502 });
    }
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
