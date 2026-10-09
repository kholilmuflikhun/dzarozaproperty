import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSheetsClient: vi.fn(),
  checkRateLimit: vi.fn(),
  cleanupRateLimitEntries: vi.fn(),
  getClientAddress: vi.fn(),
  append: vi.fn(),
}));

vi.mock("@/lib/testimonials.server", () => ({
  getSheetsClient: mocks.getSheetsClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  cleanupRateLimitEntries: mocks.cleanupRateLimitEntries,
  getClientAddress: mocks.getClientAddress,
}));

import { POST } from "./route";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: "bangun-baru",
    name: "Nama Pemesan",
    phone: "081234567890",
    email: "",
    fields: {
      lokasi: "Purbalingga",
      luasTanah: "150",
      luasBangunan: "100",
      jumlahLantai: "1 Lantai",
      jumlahKamar: "3 KT, 2 KM",
      budget: "Rp 300.000.000",
    },
    ...overrides,
  };
}

function createRequest(payload: unknown): NextRequest {
  return new Request("http://localhost/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<{ success: boolean; message: string }>;
}

describe("POST /api/order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.getClientAddress.mockReturnValue("127.0.0.1");
    mocks.getSheetsClient.mockReturnValue(null);
  });

  it("normalizes numeric and boolean detail values instead of rejecting or crashing", async () => {
    const payload = validPayload({
      fields: {
        lokasi: 123,
        luasTanah: true,
        luasBangunan: false,
        jumlahLantai: "1 Lantai",
        jumlahKamar: 2,
        budget: 300000000,
      },
    });

    const response = await POST(createRequest(payload));
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it.each([
    { label: "null", value: null },
    { label: "an object", value: {} },
    { label: "an array", value: [] },
  ])(
    "returns a validation error when a required detail is $label",
    async ({ value: lokasi }) => {
      const response = await POST(
        createRequest(
          validPayload({
            fields: { ...validPayload().fields, lokasi },
          })
        )
      );
      const body = await readJson(response);

      expect(response.status).toBe(400);
      expect(body.message).toContain("wajib diisi");
      expect(mocks.getSheetsClient).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid select values before accessing Google Sheets", async () => {
    const response = await POST(
      createRequest(
        validPayload({
          fields: { ...validPayload().fields, jumlahLantai: "Banyak Lantai" },
        })
      )
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.message).toContain("Pilihan");
    expect(mocks.getSheetsClient).not.toHaveBeenCalled();
  });

  it("appends valid orders as RAW and neutralizes formula-prefixed contact values", async () => {
    mocks.getSheetsClient.mockReturnValue({
      sheets: {
        spreadsheets: {
          values: { append: mocks.append },
        },
      },
      spreadsheetId: "test-spreadsheet",
    });

    const response = await POST(
      createRequest(validPayload({ phone: "=SUM(1,1)", email: "+user@example.com" }))
    );
    const body = await readJson(response);
    const appendArguments = mocks.append.mock.calls[0]?.[0];

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(appendArguments.valueInputOption).toBe("RAW");
    expect(appendArguments.requestBody.values[0][4]).toBe("'=SUM(1,1)");
    expect(appendArguments.requestBody.values[0][5]).toBe("'+user@example.com");
  });
});
