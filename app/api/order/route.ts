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

type OrderFieldConfig = (typeof orderFormFields)[keyof typeof orderFormFields];
type ApiError = { message: string; status: number };
type OrderContext =
  | { data: { service: (typeof services)[number]; fieldConfig: OrderFieldConfig }; error?: never }
  | { data?: never; error: ApiError };
type ValidationResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const value = typeof raw === "string" ? raw.trim() : "";

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

    const { serviceId, name, phone, email, fields } = bodyRecord;
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
            sanitizeCell(orderSummary.data.summaryLines.join("\n")),
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