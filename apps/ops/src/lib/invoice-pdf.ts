type InvoicePdfInput = {
  organizationName: string;
  invoiceNumber: string;
  status: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  clientName: string;
  projectName: string;
  currency: string;
  items: Array<{ description: string; quantity: string; unitPrice: string; lineTotal: string }>;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paidAmount: string;
  balance: string;
};

function pdfText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");
}
function wrap(value: string, width = 86) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > width) {
      lines.push(line); line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function buildInvoicePdf(input: InvoicePdfInput) {
  const money = (value: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency: input.currency, maximumFractionDigits: 2 }).format(Number(value));
  const lines = [
    input.organizationName,
    "INVOICE",
    `Nomor: ${input.invoiceNumber}    Status: ${input.status}`,
    `Tanggal terbit: ${input.issuedAt ? input.issuedAt.toLocaleDateString("id-ID") : "-"}    Jatuh tempo: ${input.dueAt ? input.dueAt.toLocaleDateString("id-ID") : "-"}`,
    `Ditagihkan kepada: ${input.clientName}`,
    `Proyek: ${input.projectName}`,
    "",
    "RINCIAN TAGIHAN",
    "Deskripsi | Qty | Harga Satuan | Jumlah",
    ...input.items.flatMap((item) => wrap(`${item.description} | ${item.quantity} | ${money(item.unitPrice)} | ${money(item.lineTotal)}`, 86)),
    "",
    `Subtotal: ${money(input.subtotal)}`,
    `Diskon: ${money(input.discount)}`,
    `Pajak: ${money(input.tax)}`,
    `TOTAL: ${money(input.total)}`,
    `Sudah dibayar: ${money(input.paidAmount)}`,
    `Sisa tagihan: ${money(input.balance)}`,
    "",
    "Dokumen ini dibuat secara elektronik oleh Dzaroza Property OS.",
  ].flatMap((line) => wrap(line, 86));
  const pageLines = 44;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageLines) pages.push(lines.slice(index, index + pageLines));
  if (!pages.length) pages.push(["INVOICE"]);
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const pageIds: number[] = [];
  pages.forEach((pageLinesForPage, pageIndex) => {
    const pageId = 4 + pageIndex * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const commands = pageLinesForPage.map((line, index) =>
      `BT /F1 9 Tf 48 ${790 - index * 16} Td (${pdfText(line)}) Tj ET`
    ).join("\n");
    const stream = commands + "\n";
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}endstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(output, "binary");
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, "binary");
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "binary");
}
