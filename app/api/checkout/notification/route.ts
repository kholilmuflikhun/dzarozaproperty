import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getOrder, isRedisConfigured, updateOrder, type OrderStatus } from "@/lib/redis";

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

  // Bandingkan dengan timingSafeEqual, bukan `===`, untuk mencegah timing
  // attack saat menebak signature yang valid.
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(payload.signature_key ?? "", "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(request: NextRequest) {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json({ success: false, message: "Order storage belum dikonfigurasi." }, { status: 503 });
    }

    const payload = await request.json();
    const { order_id, status_code, gross_amount, signature_key } = payload ?? {};

    if (
      typeof order_id !== "string" ||
      typeof status_code !== "string" ||
      typeof gross_amount !== "string" ||
      typeof signature_key !== "string"
    ) {
      return NextResponse.json({ success: false, message: "Payload tidak valid." }, { status: 400 });
    }

    const isValid = verifySignature({ order_id, status_code, gross_amount, signature_key });
    if (!isValid) {
      console.warn("[api/checkout/notification] Signature tidak valid untuk order:", order_id);
      return NextResponse.json({ success: false, message: "Signature tidak valid." }, { status: 403 });
    }

    const order = await getOrder(order_id);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan." }, { status: 404 });
    }
    if (Number(gross_amount) !== order.grossAmount) {
      return NextResponse.json({ success: false, message: "Nominal transaksi tidak cocok." }, { status: 400 });
    }

    const statusMap: Record<string, OrderStatus | undefined> = {
      settlement: "paid",
      capture: "paid",
      pending: "pending",
      deny: "failed",
      expire: "expired",
      cancel: "cancelled",
      failure: "failed",
    };
    const nextStatus = statusMap[payload.transaction_status];
    if (!nextStatus) return NextResponse.json({ success: true, ignored: true });

    const isAlreadyPaid = order.status === "paid";
    const shouldUpdate = !isAlreadyPaid || nextStatus === "paid";
    if (shouldUpdate) {
      await updateOrder(order_id, {
        status: nextStatus,
        transactionStatus: payload.transaction_status,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/checkout/notification] Gagal memproses notifikasi:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
