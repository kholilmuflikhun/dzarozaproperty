import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkRateLimit, cleanupRateLimitEntries, getClientAddress } from "@/lib/rate-limit";
import { ORDER_PHOTO_MAX_BYTES } from "@/lib/orderForm";

// ---------------------------------------------------------------------------
// app/api/order/upload/route.ts
//
// Upload foto untuk form Order Layanan Jasa. Berbeda dengan /api/upload (khusus
// admin, file besar), endpoint ini publik tanpa login sehingga dibatasi ketat:
// hanya gambar JPEG/PNG/WebP, maks 3 MB per file (browser mengompres dulu),
// dicek "magic bytes" (bukan hanya ekstensi), dan dibatasi rate limit per IP.
// ---------------------------------------------------------------------------

const TYPES: Record<string, { ext: string; match: (b: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": {
    ext: "png",
    match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  "image/webp": {
    ext: "webp",
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
};

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitEntries();
    const rateLimit = await checkRateLimit(`order-upload:${getClientAddress(request)}`, {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak unggahan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, message: "Penyimpanan foto belum dikonfigurasi di server." },
        { status: 503 }
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > ORDER_PHOTO_MAX_BYTES + 64 * 1024) {
      return NextResponse.json({ success: false, message: "Ukuran foto maksimal 3 MB." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "File tidak ditemukan." }, { status: 400 });
    }
    if (file.size === 0 || file.size > ORDER_PHOTO_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "Ukuran foto maksimal 3 MB." }, { status: 413 });
    }

    const type = TYPES[file.type];
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!type || !type.match(head)) {
      return NextResponse.json(
        { success: false, message: "Format foto harus JPG, PNG, atau WebP." },
        { status: 415 }
      );
    }

    const blob = await put(`order-photos/${Date.now()}.${type.ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({ success: true, url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("[api/order/upload] Gagal mengunggah foto:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengunggah foto. Coba lagi." },
      { status: 500 }
    );
  }
}
