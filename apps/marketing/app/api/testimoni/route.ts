import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getTestimonials } from "@/lib/testimonials.server";
import { checkRateLimit, cleanupRateLimitEntries, getClientAddress } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// app/api/testimoni/route.ts
//
// POST -> menerima data form Testimoni (nama & foto dari Google Login, plus
//         alamat, no. HP, email, review, rating) dan menuliskannya sebagai
//         baris baru ke Google Sheets — menggantikan Google Form agar alurnya
//         tetap di dalam website (seamless), tanpa redirect keluar.
//
// GET  -> mengembalikan daftar testimoni untuk ditampilkan di section Review.
//         Logika ambil data (Sheets + fallback statis) ada di
//         lib/testimonials.server.ts, dipakai bersama oleh Hero (rating
//         rata-rata) supaya datanya selalu konsisten di seluruh halaman.
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
  address: 300,
  message: 2000,
} as const;

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitEntries();
    const rateLimit = await checkRateLimit(`testimoni:${getClientAddress(request)}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak pengiriman. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32 * 1024) {
      return NextResponse.json({ success: false, message: "Payload terlalu besar." }, { status: 413 });
    }

    const body = await request.json();
    const { name, photo, email, phone, address, rating, message } = body ?? {};

    if (!name || !email || !phone || !address || !message || !rating) {
      return NextResponse.json(
        { success: false, message: "Semua field wajib diisi." },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      typeof address !== "string" ||
      typeof message !== "string" ||
      (photo !== null && typeof photo !== "undefined" && typeof photo !== "string")
    ) {
      return NextResponse.json(
        { success: false, message: "Format data tidak valid." },
        { status: 400 }
      );
    }

    // Batasi panjang tiap field — mencegah payload raksasa membebani Google
    // Sheets API atau memenuhi tampilan testimoni dengan teks tak wajar.
    if (
      name.length > MAX_LENGTHS.name ||
      email.length > MAX_LENGTHS.email ||
      phone.length > MAX_LENGTHS.phone ||
      address.length > MAX_LENGTHS.address ||
      message.length > MAX_LENGTHS.message
    ) {
      return NextResponse.json(
        { success: false, message: "Salah satu field melebihi batas panjang yang diizinkan." },
        { status: 400 }
      );
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating harus berupa angka 1 - 5." },
        { status: 400 }
      );
    }

    if (photo && (photo.length > 2048 || !isAllowedPhotoUrl(photo))) {
      return NextResponse.json(
        { success: false, message: "URL foto tidak valid." },
        { status: 400 }
      );
    }

    const client = getSheetsClient();

    if (!client) {
      // Kredensial belum diisi — beri respons jelas alih-alih gagal diam-diam.
      console.warn(
        "[api/testimoni] GOOGLE_SHEETS_* belum dikonfigurasi. Data tidak disimpan permanen."
      );
      return NextResponse.json(
        {
          success: true,
          message:
            "Testimoni diterima (mode demo — belum tersambung ke Google Sheets). Isi GOOGLE_SHEETS_* di .env untuk mengaktifkan penyimpanan.",
        },
        { status: 201 }
      );
    }

    const { sheets, spreadsheetId } = client;
    const range = process.env.GOOGLE_SHEETS_RANGE ?? "Testimoni!A:G";

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
            sanitizeCell(name),
            sanitizeCell(email),
            sanitizeCell(phone),
            sanitizeCell(address),
            String(rating),
            sanitizeCell(message),
            photo ? sanitizeCell(String(photo)) : "",
          ],
        ],
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Terima kasih! Review Anda berhasil dikirim dan akan ditinjau tim kami.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/testimoni] Gagal menulis ke Google Sheets:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat mengirim testimoni. Coba lagi." },
      { status: 500 }
    );
  }
}

function isAllowedPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "drive.google.com" ||
        url.hostname === "lh3.googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com") ||
        url.hostname.endsWith(".public.blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const data = await getTestimonials();
  return NextResponse.json({ success: true, data });
}