import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/testimonials.server";
import { checkRateLimit, cleanupRateLimitEntries, getClientAddress } from "@/lib/rate-limit";
import { orderFormFields, orderPhotoFields } from "@/lib/orderForm";
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
function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function sanitizeCell(value: string | number | boolean | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return FORMULA_PREFIX.test(normalized) ? `'${normalized}` : normalized;
}

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  phone: 20,
  address: 500,
  fieldValue: 500,
  textarea: 2000,
} as const;

type OrderFieldConfig = (typeof orderFormFields)[keyof typeof orderFormFields];
type ApiError = { message: string; status: number };
type OrderContext =
  | { data: { service: (typeof services)[number]; fieldConfig: OrderFieldConfig }; error?: never }
  | { data?: never; error: ApiError };
type ValidationResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };

const EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}

function getOrderContext(serviceId: unknown): OrderContext {
  const normalizedServiceId = typeof serviceId === "string" ? serviceId.trim() : "";
  const service = services.find((s) => s.id === normalizedServiceId);
  const fieldConfig = normalizedServiceId ? orderFormFields[normalizedServiceId] : undefined;

  if (!service || !fieldConfig) {
    return { error: { message: "Kategori layanan tidak valid.", status: 400 } };
  }

  return { data: { service, fieldConfig } };
}

function validateContactInput(
  name: unknown,
  phone: unknown,
  email: unknown
): ValidationResult<{ name: string; phone: string; email?: string }> {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  const trimmedEmail = typeof email === "string" ? email.trim() : "";

  if (!trimmedName || !trimmedPhone) {
    return { error: { message: "Nama dan No. WhatsApp wajib diisi.", status: 400 } };
  }

  if (email !== undefined && email !== null && typeof email !== "string") {
    return { error: { message: "Format email tidak valid.", status: 400 } };
  }

  if (
    trimmedName.length > MAX_LENGTHS.name ||
    trimmedPhone.length > MAX_LENGTHS.phone ||
    (typeof email === "string" && trimmedEmail.length > MAX_LENGTHS.email)
  ) {
    return {
      error: { message: "Salah satu field melebihi batas panjang yang diizinkan.", status: 400 },
    };
  }

  if (trimmedEmail && !isValidEmail(trimmedEmail)) {
    return { error: { message: "Format email tidak valid.", status: 400 } };
  }

  return {
    data: { name: trimmedName, phone: trimmedPhone, email: trimmedEmail || undefined },
  };
}

function buildOrderSummary(
  fieldConfig: OrderFieldConfig,
  fields: Record<string, unknown>
): ValidationResult<{ summaryLines: string[] }> {
  const summaryLines: string[] = [];

  for (const field of fieldConfig) {
    const raw = fields[field.name];
    const value = normalizeText(raw);

    if (field.required && !value) {
      return { error: { message: `Field "${field.label}" wajib diisi.`, status: 400 } };
    }

    const maxLen = field.type === "textarea" ? MAX_LENGTHS.textarea : MAX_LENGTHS.fieldValue;
    if (value.length > maxLen) {
      return { error: { message: `Field "${field.label}" terlalu panjang.`, status: 400 } };
    }

    if (field.type === "select" && value && !field.options?.includes(value)) {
      return { error: { message: `Pilihan "${field.label}" tidak valid.`, status: 400 } };
    }

    if (value) summaryLines.push(`${field.label}: ${value}`);
  }

  return { data: { summaryLines } };
}

// Foto hanya boleh berasal dari Vercel Blob kita (hasil /api/order/upload),
// supaya endpoint publik ini tidak bisa dipakai menyisipkan URL sembarang.
function isBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function buildPhotoLines(serviceId: string, photos: unknown): ValidationResult<{ lines: string[] }> {
  const config = orderPhotoFields[serviceId] ?? [];
  const lines: string[] = [];
  if (photos === undefined || photos === null) return { data: { lines } };
  if (typeof photos !== "object" || Array.isArray(photos)) {
    return { error: { message: "Data foto tidak valid.", status: 400 } };
  }

  for (const field of config) {
    const raw = (photos as Record<string, unknown>)[field.name];
    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw) || raw.length > field.max) {
      return { error: { message: `Foto "${field.label}" tidak valid.`, status: 400 } };
    }
    const urls = raw.filter((u): u is string => typeof u === "string" && u.length <= 500);
    if (urls.length !== raw.length || !urls.every(isBlobUrl)) {
      return { error: { message: `Foto "${field.label}" tidak valid.`, status: 400 } };
    }
    if (urls.length) lines.push(`${field.label}: ${urls.join(" , ")}`);
  }
  return { data: { lines } };
}

function buildLocationLine(location: unknown): ValidationResult<{ line?: string }> {
  if (location === undefined || location === null) return { data: {} };
  if (typeof location !== "object" || Array.isArray(location)) {
    return { error: { message: "Data lokasi tidak valid.", status: 400 } };
  }
  const { lat, lng, accuracy } = location as Record<string, unknown>;
  if (
    typeof lat !== "number" || typeof lng !== "number" ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return { error: { message: "Koordinat lokasi tidak valid.", status: 400 } };
  }
  const acc = typeof accuracy === "number" && Number.isFinite(accuracy) ? ` (akurasi ±${Math.round(accuracy)} m)` : "";
  return {
    data: {
      line: `Lokasi Dibagikan: https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}${acc}`,
    },
  };
}

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Format data tidak valid." }, { status: 400 });
    }

    const bodyRecord = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (!bodyRecord) {
      return NextResponse.json({ success: false, message: "Format data tidak valid." }, { status: 400 });
    }

    const { serviceId, name, phone, email, address, fields, photos, location } = bodyRecord;
    const orderContext = getOrderContext(serviceId);
    if (orderContext.error) {
      return NextResponse.json(
        { success: false, message: orderContext.error.message },
        { status: orderContext.error.status }
      );
    }

    const contact = validateContactInput(name, phone, email);
    if (contact.error) {
      return NextResponse.json(
        { success: false, message: contact.error.message },
        { status: contact.error.status }
      );
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return NextResponse.json({ success: false, message: "Detail order tidak valid." }, { status: 400 });
    }

    const orderSummary = buildOrderSummary(orderContext.data.fieldConfig, fields as Record<string, unknown>);
    if (orderSummary.error) {
      return NextResponse.json(
        { success: false, message: orderSummary.error.message },
        { status: orderSummary.error.status }
      );
    }

    const photoLines = buildPhotoLines(orderContext.data.service.id, photos);
    if (photoLines.error) {
      return NextResponse.json(
        { success: false, message: photoLines.error.message },
        { status: photoLines.error.status }
      );
    }

    const locationLine = buildLocationLine(location);
    if (locationLine.error) {
      return NextResponse.json(
        { success: false, message: locationLine.error.message },
        { status: locationLine.error.status }
      );
    }

    if (address !== undefined && address !== null && typeof address !== "string") {
      return NextResponse.json({ success: false, message: "Format alamat tidak valid." }, { status: 400 });
    }
    const trimmedAddress = typeof address === "string" ? address.trim() : "";
    if (trimmedAddress.length > MAX_LENGTHS.address) {
      return NextResponse.json({ success: false, message: "Alamat maksimal 500 karakter." }, { status: 400 });
    }

    const summaryLines = [
      ...(trimmedAddress ? [`Alamat Lengkap: ${trimmedAddress}`] : []),
      ...orderSummary.data.summaryLines,
      ...(locationLine.data.line ? [locationLine.data.line] : []),
      ...photoLines.data.lines,
    ];

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
            sanitizeCell(orderContext.data.service.kategori),
            sanitizeCell(orderContext.data.service.title),
            sanitizeCell(contact.data.name),
            sanitizeCell(contact.data.phone),
            typeof contact.data.email === "string" && contact.data.email ? sanitizeCell(contact.data.email) : "",
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