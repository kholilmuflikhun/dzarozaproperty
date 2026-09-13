import { NextRequest, NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { products } from "@/lib/data";

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
    const body = await request.json();
    const { slug, name, email, phone } = body ?? {};

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

    // order_id harus unik per transaksi — kombinasi slug produk + timestamp.
    const orderId = `DZAROZA-${product.slug.toUpperCase()}-${Date.now()}`;

    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: product.priceAmount,
      },
      credit_card: { secure: true },
      customer_details: {
        first_name: name || "Pelanggan Dzaroza Property",
        email: email || undefined,
        phone: phone || undefined,
      },
      item_details: [
        {
          id: product.slug,
          price: product.priceAmount,
          quantity: 1,
          name: product.title.slice(0, 50), // Midtrans membatasi panjang nama item
        },
      ],
    });

    return NextResponse.json({
      success: true,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      orderId,
    });
  } catch (error) {
    console.error("[api/checkout] Gagal membuat transaksi Midtrans:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat transaksi pembayaran. Coba lagi." },
      { status: 500 }
    );
  }
}
