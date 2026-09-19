import { NextRequest, NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { randomUUID } from "crypto";
import { products } from "@/lib/data";
import { checkRateLimit, cleanupRateLimitEntries, getClientAddress } from "@/lib/rate-limit";
import { isRedisConfigured, saveOrder, updateOrder, type Order } from "@/lib/redis";

// ---------------------------------------------------------------------------
// app/api/checkout/route.ts
//
// POST -> menerima { slug, name?, email?, phone? }, membuat transaksi Midtrans
//         Snap untuk produk digital terkait, lalu mengembalikan { token,
//         redirectUrl } yang dipakai frontend untuk memanggil window.snap.pay().
//
// Wajib isi MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY (dan MIDTRANS_IS_PRODUCTION)
// di .env — dapatkan dari dashboard.midtrans.com (Settings → Access Keys).
// ---------------------------------------------------------------------------

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

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitEntries();
    const rateLimit = await checkRateLimit(`checkout:${getClientAddress(request)}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak percobaan checkout. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { success: false, message: "Sistem order belum dikonfigurasi." },
        { status: 503 }
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16 * 1024) {
      return NextResponse.json({ success: false, message: "Payload terlalu besar." }, { status: 413 });
    }

    const body = await request.json();
    const { slug, name, email, phone } = body ?? {};

    if (
      typeof slug !== "string" ||
      typeof name !== "undefined" && typeof name !== "string" ||
      typeof email !== "undefined" && typeof email !== "string" ||
      typeof phone !== "undefined" && typeof phone !== "string"
    ) {
      return NextResponse.json({ success: false, message: "Format data tidak valid." }, { status: 400 });
    }

    if (
      slug.length > 100 ||
      (name !== undefined && name.length > 100) ||
      (email !== undefined && email.length > 254) ||
      (phone !== undefined && phone.length > 30) ||
      email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json({ success: false, message: "Data checkout tidak valid." }, { status: 400 });
    }

    const product = products.find((p) => p.slug === slug);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }

    const snap = getSnapClient();
    if (!snap) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment Gateway belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY di .env, atau gunakan opsi pemesanan via WhatsApp.",
        },
        { status: 503 }
      );
    }

    const orderId = `DZAROZA-${product.slug.toUpperCase()}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const order: Order = {
      orderId,
      slug: product.slug,
      grossAmount: product.priceAmount,
      status: "pending",
      customer: {
        name: name?.trim() || "Pelanggan Dzaroza Property",
        email: email?.trim().toLowerCase() || undefined,
        phone: phone?.trim() || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    await saveOrder(order);

    try {
      const transaction = await snap.createTransaction({
        transaction_details: {
          order_id: orderId,
          gross_amount: product.priceAmount,
        },
        credit_card: { secure: true },
        customer_details: order.customer,
        item_details: [
          {
            id: product.slug,
            price: product.priceAmount,
            quantity: 1,
            name: product.title.slice(0, 50),
          },
        ],
      });
      await updateOrder(orderId, { midtransToken: transaction.token });

      return NextResponse.json({
        success: true,
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId,
      });
    } catch (error) {
      await updateOrder(orderId, { status: "failed" });
      throw error;
    }
  } catch (error) {
    console.error("[api/checkout] Gagal membuat transaksi Midtrans:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat transaksi pembayaran. Coba lagi." },
      { status: 500 }
    );
  }
}
