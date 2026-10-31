import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  try {
    const { organizationId, invoiceId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !invoiceId || invoiceId.length > 64) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const [organization, invoice] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, currency: true } }),
      prisma.invoice.findFirst({
        where: { organizationId, id: invoiceId },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          project: { include: { client: { select: { name: true } } } },
          quotation: { include: { client: { select: { name: true } } } },
        },
      }),
    ]);
    if (!organization || !invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    const clientName = invoice.project?.client.name ?? invoice.quotation?.client.name ?? "Klien";
    const buffer = buildInvoicePdf({
      organizationName: organization.name,
      invoiceNumber: invoice.number,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      clientName,
      projectName: invoice.project?.name ?? "-",
      currency: organization.currency,
      items: invoice.items.map((item) => ({
        description: item.description, quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      discount: invoice.discount.toString(),
      tax: invoice.tax.toString(),
      total: invoice.total.toString(),
      paidAmount: invoice.paidAmount.toString(),
      balance: invoice.total.minus(invoice.paidAmount).toString(),
    });
    const filename = `${invoice.number.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(buffer.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
