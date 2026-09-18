import { google } from "googleapis";
import { testimonials as staticTestimonials, type Testimonial } from "./data";

// PERINGATAN: modul ini HANYA boleh diimpor dari Server Component atau Route
// Handler (server-only) karena memakai googleapis & kredensial Google Sheets.
// Jangan pernah diimpor dari komponen yang berisi "use client".

export function getSheetsClient() {
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

// Mengambil daftar testimoni — dari Google Sheets bila kredensial tersedia,
// fallback ke data statis (lib/data.ts) bila belum dikonfigurasi atau gagal
// dibaca. Dipakai bersama oleh GET /api/testimoni (untuk section Testimoni)
// dan Hero (untuk rating rata-rata), supaya logikanya tidak dobel dan
// datanya selalu konsisten di seluruh halaman.
export async function getTestimonials(): Promise<Testimonial[]> {
  const client = getSheetsClient();
  if (!client) return staticTestimonials;

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

    return data.length ? data : staticTestimonials;
  } catch (error) {
    console.error("[lib/testimonials.server] Gagal membaca Google Sheets, fallback ke data statis:", error);
    return staticTestimonials;
  }
}