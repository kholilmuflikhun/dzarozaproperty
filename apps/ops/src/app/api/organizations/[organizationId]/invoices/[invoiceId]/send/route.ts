import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";
import { sendTransactionalEmail } from "@/lib/email";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, context: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  try {
    const { organizationId, invoiceId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !invoiceId || invoiceId.length > 64) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.FINANCE]);
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json({ error: "Layanan email belum dikonfigurasi. Atur RESEND_API_KEY dan RESEND_FROM_EMAIL." }, { status: 503 });
    }
    const [organization, invoice] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, currency: true } }),
      prisma.invoice.findFirst({
        where: { organizationId, id: invoiceId },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          project: { select: { name: true, client: { select: { name: true, email: true } } } },
          quotation: { include: { client: { select: { name: true, email: true } } } },
        },
      }),
    ]);
    if (!organization || !invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!["SENT", "PARTIALLY_PAID", "OVERDUE", "PAID"].includes(invoice.status)) {
      return NextResponse.json({ error: "Invoice harus diterbitkan sebelum dikirim ke klien." }, { status: 409 });
    }
    const client = invoice.project?.client ?? invoice.quotation?.client;
    if (!client?.email) return NextResponse.json({ error: "Email klien belum tersedia." }, { status: 422 });
    const pdf = buildInvoicePdf({
      organizationName: organization.name, invoiceNumber: invoice.number, status: invoice.status,
      issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, clientName: client.name,
      projectName: invoice.project?.name ?? "-", currency: organization.currency,
      items: invoice.items.map((item) => ({
        description: item.description, quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(),
      })),
      subtotal: invoice.subtotal.toString(), discount: invoice.discount.toString(), tax: invoice.tax.toString(),
      total: invoice.total.toString(), paidAmount: invoice.paidAmount.toString(),
      balance: invoice.total.minus(invoice.paidAmount).toString(),
    });
    const result = await sendTransactionalEmail({
      to: client.email,
      subject: `Invoice ${invoice.number} — ${organization.name}`,
      text: `Halo ${client.name}, terlampir invoice ${invoice.number} dari ${organization.name}. Total: ${invoice.total.toString()} ${organization.currency}. Sisa tagihan: ${invoice.total.minus(invoice.paidAmount).toString()} ${organization.currency}.`,
      html: `<p>Halo ${client.name.replace(/[&<>"']/g, "")},</p><p>Terlampir invoice <strong>${invoice.number}</strong> dari ${organization.name.replace(/[&<>"']/g, "")}.</p><p>Total: <strong>${invoice.total.toString()} ${organization.currency}</strong></p><p>Sisa tagihan: <strong>${invoice.total.minus(invoice.paidAmount).toString()} ${organization.currency}</strong></p>`,
      attachments: [{ filename: `${invoice.number.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`, content: pdf.toString("base64") }],
    });
    if (!result.sent) {
      await prisma.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "invoice.email.failed",
          entityType: "Invoice", entityId: invoiceId,
          metadata: { recipient: client.email, reason: result.reason, providerStatus: "status" in result ? result.status : null },
        },
      });
      return NextResponse.json({ error: "Email invoice gagal dikirim. Periksa konfigurasi atau status provider." }, { status: 502 });
    }
    await prisma.auditLog.create({
      data: {
        organizationId, actorId: actor.userId, action: "invoice.email.sent",
        entityType: "Invoice", entityId: invoiceId,
        metadata: { recipient: client.email, messageId: result.messageId },
      },
    });
    return NextResponse.json({ message: "Invoice PDF berhasil dikirim ke email klien.", invoiceNumber: invoice.number }, { status: 200 });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
