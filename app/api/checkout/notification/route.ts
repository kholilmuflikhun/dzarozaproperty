import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// app/api/checkout/notification/route.ts
//
// Endpoint webhook yang dipanggil Midtrans secara server-to-server setiap kali
// status transaksi berubah (settlement, pending, deny, expire, cancel).
// Daftarkan URL ini di dashboard Midtrans:
//   Settings → Configuration → Payment Notification URL
//   -> https://domain-anda.com/api/checkout/notification
//
// PENTING: jangan percaya status dari redirect di browser (bisa dimanipulasi).
// Selalu verifikasi lewat signature_key di webhook ini sebelum menandai
// pesanan sebagai "lunas".
// ---------------------------------------------------------------------------

function verifySignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const raw = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  return expected === payload.signature_key;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { order_id, transaction_status, fraud_status, status_code, gross_amount, signature_key } =
      payload ?? {};

    if (!order_id || !signature_key) {
      return NextResponse.json({ success: false, message: "Payload tidak valid." }, { status: 400 });
    }

    const isValid = verifySignature({ order_id, status_code, gross_amount, signature_key });
    if (!isValid) {
      console.warn("[api/checkout/notification] Signature tidak valid untuk order:", order_id);
      return NextResponse.json({ success: false, message: "Signature tidak valid." }, { status: 403 });
    }

    // Tentukan status akhir pesanan berdasarkan transaction_status dari Midtrans.
    let orderStatus: "paid" | "pending" | "failed" = "pending";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      orderStatus = fraud_status === "challenge" ? "pending" : "paid";
    } else if (["deny", "cancel", "expire", "failure"].includes(transaction_status)) {
      orderStatus = "failed";
    }

    // TODO (produksi): simpan/​update status pesanan di database Anda di sini,
    // lalu kirim notifikasi WhatsApp/email otomatis ke pembeli & tim internal
    // saat orderStatus === "paid" (mis. lewat WhatsApp Business API atau
    // nodemailer). Untuk saat ini, cukup dicatat di log server.
    console.log(`[api/checkout/notification] Order ${order_id} -> ${orderStatus}`, {
      transaction_status,
      fraud_status,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/checkout/notification] Gagal memproses notifikasi:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
