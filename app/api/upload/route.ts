import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// app/api/upload/route.ts
//
// Endpoint ini TIDAK menerima file secara langsung — ia hanya menerbitkan
// "token upload" sementara ke browser (metode CLIENT UPLOAD Vercel Blob).
// File sesudahnya dikirim LANGSUNG dari browser ke Vercel Blob storage,
// tanpa lewat server ini sama sekali. Ini yang memungkinkan upload file
// besar (video, dll) sampai 5 TB — beda dengan upload lewat server biasa
// yang di Vercel dibatasi hanya 4.5 MB per request.
//
// Alurnya:
//   1. Browser (app/admin/upload/page.tsx) memanggil upload() dari
//      "@vercel/blob/client", yang otomatis POST ke endpoint ini dulu
//      untuk minta token.
//   2. onBeforeGenerateToken di bawah memvalidasi kata sandi (UPLOAD_SECRET)
//      sebelum mengizinkan token diterbitkan — mencegah orang luar upload
//      sembarangan ke storage kita.
//   3. Browser memakai token itu untuk kirim file langsung ke Blob storage.
//   4. onUploadCompleted dipanggil (via webhook Vercel) setelah upload
//      selesai — hanya untuk logging/notifikasi, opsional.
//
// Wajib isi BLOB_READ_WRITE_TOKEN (otomatis ada begitu Blob store dibuat &
// dihubungkan ke project di dashboard Vercel) dan UPLOAD_SECRET (kata sandi
// bebas buatan sendiri) di .env.
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!process.env.UPLOAD_SECRET) {
          throw new Error("UPLOAD_SECRET belum dikonfigurasi di server.");
        }
        if (clientPayload !== process.env.UPLOAD_SECRET) {
          throw new Error("Kata sandi upload salah.");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/svg+xml",
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "application/pdf",
          ],
          addRandomSuffix: true,
          // Batas ukuran file — sesuaikan sendiri kalau perlu lebih besar.
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Webhook ini membutuhkan URL publik dan aktif setelah situs di-deploy.
        void blob.url;
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[api/upload] Gagal menerbitkan token upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload gagal." },
      { status: 400 } // Vercel akan retry webhook 5x kalau bukan status 200
    );
  }
}
