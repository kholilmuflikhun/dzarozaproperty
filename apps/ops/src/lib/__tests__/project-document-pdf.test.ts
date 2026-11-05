import { describe, expect, it } from "vitest";
import { buildProjectDocumentPdf } from "../project-document-pdf";

const sample = {
  title: "Surat Perjanjian Kerja",
  number: "001/SPK/PROJECT-01/2026",
  generatedAt: "2026-11-05T10:00:00.000Z",
  organization: { name: "Dzaroza Property", address: "Banyumas", phone: "081234", email: "hello@example.com", ownerName: "Owner", bankName: "Bank Syariah", bankAccountNumber: "123456", bankAccountName: "Dzaroza" },
  project: { name: "Renovasi Kantor", code: "PROJECT-01", siteAddress: "Purwokerto", startAt: "2026-11-01T00:00:00.000Z", dueAt: "2026-12-01T00:00:00.000Z", progress: 35, notes: "Pekerjaan tahap pertama" },
  client: { name: "Klien Contoh", address: "Banyumas", email: "client@example.com", phone: "0812345" },
  workItems: [{ description: "Pekerjaan interior", quantity: 2, unit: "unit", unitPrice: 1500000, lineTotal: 3000000 }],
  paymentTerms: [{ sequence: 1, name: "Uang muka", condition: "Saat tanda tangan", percentage: 30, amount: 900000, status: "UNPAID" }],
  totals: { subtotal: 3000000, changeOrderNet: 0, finalValue: 3000000, paidAmount: 0, outstanding: 3000000 },
};

describe("project document PDF renderer", () => {
  it("creates a PDF snapshot with project, client and financial details", () => {
    const pdf = buildProjectDocumentPdf(sample).toString("binary");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("001/SPK/PROJECT-01/2026");
    expect(pdf).toContain("Renovasi Kantor");
    expect(pdf).toContain("Sisa:");
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });

  it("supports multi-page documents and escapes PDF delimiters", () => {
    const pdf = buildProjectDocumentPdf({
      ...sample,
      client: { ...sample.client, name: "Client (A) \\ B" },
      workItems: Array.from({ length: 100 }, (_, index) => ({ description: `Pekerjaan ${index + 1}`, quantity: 1, unit: "unit", unitPrice: 1000, lineTotal: 1000 })),
    }).toString("binary");
    expect(pdf).toContain("/Count 3");
    expect(pdf).toContain("Client \\(A\\) \\\\ B");
  });
});
