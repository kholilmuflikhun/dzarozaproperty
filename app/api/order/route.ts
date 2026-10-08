import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/testimonials.server";
import { checkRateLimit, cleanupRateLimitEntries, getClientAddress } from "@/lib/rate-limit";
import { orderFormFields } from "@/lib/orderForm";
import { services } from "@/lib/data";

// ---------------------------------------------------------------------------
// app/api/order/route.ts
//
// POST -> menerima pengajuan "Order Layanan Jasa" (Kategori A-D) dari
//         OrderForm multi-step di section Layanan, lalu menuliskannya sebagai
//         baris baru ke Google Sheets (tab terpisah dari Testimoni). Field
//         dinamis per kategori (lib/orderForm.ts) digabung jadi satu kolom
//         ringkasan supaya skema sheet tetap sederhana & seragam untuk semua
//         kategori, walau jumlah/jenis fieldnya berbeda-beda.
// ---------------------------------------------------------------------------

// Karakter yang bisa memicu Google Sheets/Excel membaca sel sebagai formula
// (Formula/CSV Injection) bila diawali salah satu dari ini. Endpoint ini bisa
// diisi siapa saja tanpa login, jadi input harus dianggap tidak tepercaya.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
function sanitizeCell(value: string) {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  phone: 20,
  fieldValue: 500,
  textarea: 2000,
} as const;

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitEntries();
    const rateLimit = await checkRateLimit(`order:${getClientAddress(request)}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak pengajuan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32 * 1024) {
      return NextResponse.json({ success: false, message: "Payload terlalu besar." }, { status: 413 });
    }

    const body = await request.json();
    const { serviceId, name, phone, email, fields } = body ?? {};

    const service = services.find((s) => s.id === serviceId);
    const fieldConfig = typeof serviceId === "string" ? orderFormFields[serviceId] : undefined;
    if (!service || !fieldConfig) {
      return NextResponse.json({ success: false, message: "Kategori layanan tidak valid." }, { status: 400 });
    }

    if (!name || !phone || typeof name !== "string" || typeof phone !== "string") {
      return NextResponse.json(
        { success: false, message: "Nama dan No. WhatsApp wajib diisi." },
        { status: 400 }
      );
    }
    if (email !== undefined && email !== null && typeof email !== "string") {
      return NextResponse.json({ success: false, message: "Format email tidak valid." }, { status: 400 });
    }
    if (
      name.length > MAX_LENGTHS.name ||
      phone.length > MAX_LENGTHS.phone ||
      (typeof email === "string" && email.length > MAX_LENGTHS.email)
    ) {
      return NextResponse.json(
        { success: false, message: "Salah satu field melebihi batas panjang yang diizinkan." },
        { status: 400 }
      );
    }

    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ success: false, message: "Detail order tidak valid." }, { status: 400 });
    }

    // Validasi tiap field dinamis sesuai konfigurasi kategori yang dipilih,
    // sekaligus menyusun ringkasan "Label: nilai" untuk disimpan jadi satu
    // kolom di Sheets.
    const summaryLines: string[] = [];
    for (const f of fieldConfig) {
      const raw = (fields as Record<string, unknown>)[f.name];
      const value = typeof raw === "string" ? raw.trim() : "";

      if (f.required && !value) {
        return NextResponse.json(
          { success: false, message: `Field "${f.label}" wajib diisi.` },
          { status: 400 }
        );
      }

      const maxLen = f.type === "textarea" ? MAX_LENGTHS.textarea : MAX_LENGTHS.fieldValue;
      if (value.length > maxLen) {
        return NextResponse.json(
          { success: false, message: `Field "${f.label}" terlalu panjang.` },
          { status: 400 }
        );
      }

      if (f.type === "select" && value && !f.options?.includes(value)) {
        return NextResponse.json(
          { success: false, message: `Pilihan "${f.label}" tidak valid.` },
          { status: 400 }
        );
      }

      if (value) summaryLines.push(`${f.label}: ${value}`);
    }

    const client = getSheetsClient();

    if (!client) {
      // Kredensial belum diisi — beri respons jelas alih-alih gagal diam-diam.
      console.warn(
        "[api/order] GOOGLE_SHEETS_* belum dikonfigurasi. Order tidak disimpan permanen."
      );
      return NextResponse.json(
        {
          success: true,
          message:
            "Order diterima (mode demo — belum tersambung ke Google Sheets). Isi GOOGLE_SHEETS_* di .env untuk mengaktifkan penyimpanan.",
        },
        { status: 201 }
      );
    }

    const { sheets, spreadsheetId } = client;
    const range = process.env.GOOGLE_SHEETS_ORDER_RANGE ?? "Order!A:G";

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      // RAW (bukan USER_ENTERED): mencegah Google Sheets menafsirkan input
      // sebagai formula (Formula/CSV Injection) — endpoint ini publik dan
      // tanpa login, jadi setiap input harus dianggap tidak tepercaya.
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            sanitizeCell(service.kategori),
            sanitizeCell(service.title),
            sanitizeCell(name),
            sanitizeCell(phone),
            typeof email === "string" && email ? sanitizeCell(email) : "",
            sanitizeCell(summaryLines.join("\n")),
          ],
        ],
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Terima kasih! Pengajuan order Anda berhasil dikirim, tim kami akan segera menghubungi Anda.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/order] Gagal menulis ke Google Sheets:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat mengirim order. Coba lagi." },
      { status: 500 }
    );
  }
}