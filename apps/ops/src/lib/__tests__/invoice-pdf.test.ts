import { describe, expect, it } from "vitest";
import { buildInvoicePdf } from "../invoice-pdf";

const base = {
  organizationName: "Dzaroza Property", invoiceNumber: "INV-20261031-ABC12345", status: "SENT",
  issuedAt: new Date("2026-10-31T00:00:00.000Z"), dueAt: new Date("2026-11-30T00:00:00.000Z"),
  clientName: "Klien Contoh", projectName: "Renovasi Kantor", currency: "IDR",
  items: [{ description: "Jasa desain dan manajemen proyek", quantity: "2.000", unitPrice: "1500000.00", lineTotal: "3000000.00" }],
  subtotal: "3000000.00", discount: "0.00", tax: "0.00", total: "3000000.00",
  paidAmount: "1000000.00", balance: "2000000.00",
};

describe("invoice PDF renderer", () => {
  it("generates a valid PDF header, xref and invoice totals", () => {
    const pdf = buildInvoicePdf(base).toString("binary");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("xref");
    expect(pdf).toContain("INV-20261031-ABC12345");
    expect(pdf).toContain("Sisa tagihan");
    expect(pdf).toContain("2.000.000");
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });
  it("creates multiple pages for long item lists", () => {
    const pdf = buildInvoicePdf({ ...base, items: Array.from({ length: 100 }, (_, index) => ({
      description: `Layanan ${index + 1}`, quantity: "1.000", unitPrice: "1000.00", lineTotal: "1000.00",
    })) }).toString("binary");
    expect(pdf).toContain("/Count 3");
    expect(pdf.match(/\/Type \/Page /g)?.length).toBe(3);
  });
  it("escapes PDF delimiters in user-provided text", () => {
    const pdf = buildInvoicePdf({ ...base, clientName: "Client (A) \\ B" }).toString("binary");
    expect(pdf).toContain("Client \\(A\\) \\\\ B");
  });
});
