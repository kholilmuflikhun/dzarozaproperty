import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getTestimonials } from "@/lib/testimonials.server";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, photo, email, phone, address, rating, message } = body ?? {};

    if (!name || !email || !phone || !address || !message || !rating) {
      return NextResponse.json(
        { success: false, message: "Semua field wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating harus berupa angka 1 - 5." },
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
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            name,
            email,
            phone,
            address,
            String(rating),
            message,
            photo ?? "",
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

export async function GET() {
  const data = await getTestimonials();
  return NextResponse.json({ success: true, data });
}