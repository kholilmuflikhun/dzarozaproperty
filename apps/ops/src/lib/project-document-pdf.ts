type ProjectPdfInput = {
  title: string;
  number: string;
  generatedAt: string;
  organization: { name: string; address: string; phone: string; email: string; ownerName: string; bankName: string; bankAccountNumber: string; bankAccountName: string };
  project: { name: string; code: string; siteAddress: string; startAt: string | Date | null; dueAt: string | Date | null; progress: number; notes: string };
  client: { name: string; address: string; email?: string | null; phone?: string | null };
  workItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }>;
  paymentTerms: Array<{ sequence: number; name: string; condition: string; percentage: number; amount: number; status: string }>;
  totals: { subtotal: number; changeOrderNet: number; finalValue: number; paidAmount: number; outstanding: number };
};

function safePdfText(value: unknown) {
  return String(value ?? "-").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");
}
function wrapPdfText(value: string, width = 88) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = []; let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > width) { lines.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function buildProjectDocumentPdf(input: ProjectPdfInput) {
  const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
  const date = (value: string | Date | null) => value ? new Date(value).toLocaleDateString("id-ID") : "-";
  const lines = [
    input.organization.name || "DZAROZA PROPERTY",
    input.organization.address,
    [input.organization.phone, input.organization.email].filter(Boolean).join(" | "),
    "",
    input.title.toUpperCase(),
    "Nomor: " + input.number,
    "Tanggal: " + date(input.generatedAt),
    "",
    "DATA PROYEK",
    "Nama: " + input.project.name + " (" + input.project.code + ")",
    "Lokasi: " + input.project.siteAddress,
    "Klien: " + input.client.name,
    "Alamat klien: " + input.client.address,
    "Telepon/email: " + [input.client.phone, input.client.email].filter(Boolean).join(" / "),
    "Periode: " + date(input.project.startAt) + " s.d. " + date(input.project.dueAt),
    "Progres: " + input.project.progress + "%",
    "",
    "RINCIAN PEKERJAAN",
    "Uraian | Volume | Harga Satuan | Jumlah",
    ...input.workItems.map((item, index) => `${index + 1}. ${item.description} | ${item.quantity} ${item.unit} | ${money(item.unitPrice)} | ${money(item.lineTotal)}`),
    "",
    "JADWAL PEMBAYARAN",
    ...input.paymentTerms.map((term) => `${term.sequence}. ${term.name} - ${term.percentage}% - ${money(term.amount)} - ${term.status}`),
    "",
    "RINGKASAN NILAI",
    "Subtotal: " + money(input.totals.subtotal),
    "Perubahan pekerjaan: " + money(input.totals.changeOrderNet),
    "Nilai kontrak akhir: " + money(input.totals.finalValue),
    "Sudah dibayar: " + money(input.totals.paidAmount),
    "Sisa: " + money(input.totals.outstanding),
    "",
    "Bank: " + input.organization.bankName,
    "Rekening: " + input.organization.bankAccountNumber + " a.n. " + input.organization.bankAccountName,
    "",
    "Catatan: " + input.project.notes,
    "",
    "Dokumen elektronik dibuat melalui Dzaroza Property OS.",
  ].flatMap((line) => wrapPdfText(line));
  const pageSize = 44; const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) pages.push(lines.slice(i, i + pageSize));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2; const streamId = pageId + 1; pageIds.push(pageId);
    const commands = [
      ...page.map((line, row) => `BT /F1 9 Tf 48 ${790 - row * 16} Td (${safePdfText(line)}) Tj ET`),
      `BT /F1 8 Tf 48 35 Td (${safePdfText(input.number)} | Halaman ${index + 1} dari ${pages.length}) Tj ET`,
    ].join("\n") + "\n";
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${Buffer.byteLength(commands, "binary")} >>\nstream\n${commands}endstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n"; const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(output, "binary"); output += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = Buffer.byteLength(output, "binary");
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}
