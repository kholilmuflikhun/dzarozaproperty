import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { testimonials as staticTestimonials } from "@/lib/data";

// ---------------------------------------------------------------------------
// app/api/testimoni/route.ts
//
// POST -> menerima data form Testimoni (nama & foto dari Google Login, plus
//         alamat, no. HP, email, review, rating) dan menuliskannya sebagai
//         baris baru ke Google Sheets — menggantikan Google Form agar alurnya
//         tetap di dalam website (seamless), tanpa redirect keluar.
//
// GET  -> mengembalikan daftar testimoni untuk ditampilkan di section Review.
//         Fallback ke data statis (lib/data.ts) bila kredensial Google Sheets
//         belum diisi, supaya UI tetap bisa di-preview tanpa setup dulu.
// ---------------------------------------------------------------------------

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) return null;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

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
  const client = getSheetsClient();

  if (!client) {
    return NextResponse.json({ success: true, source: "static", data: staticTestimonials });
  }

  try {
    const { sheets, spreadsheetId } = client;
    const range = process.env.GOOGLE_SHEETS_RANGE ?? "Testimoni!A:G";
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values ?? [];

    // Kolom: [Timestamp, Nama, Email, No.HP, Alamat, Rating, Review, FotoURL]
    // .slice(1) melewati baris 1 (header kolom), supaya tidak ikut tampil
    // sebagai testimoni sungguhan. Baris yang nama/review-nya kosong juga
    // disaring (mis. baris kosong tak sengaja ke-input di spreadsheet).
    const data = rows
      .slice(1)
      .map((row, i) => ({
        id: String(i),
        name: row[1]?.trim() || "",
        rating: Number(row[5]) || 0,
        message: row[6]?.trim() || "",
        photo: row[7] || undefined,
      }))
      .filter((t) => t.name && t.message);

    return NextResponse.json({ success: true, source: "sheets", data: data.length ? data : staticTestimonials });
  } catch (error) {
    console.error("[api/testimoni] Gagal membaca Google Sheets, fallback ke data statis:", error);
    return NextResponse.json({ success: true, source: "static", data: staticTestimonials });
  }
}