import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("issue") }),
  z.object({ action: z.literal("void") }),
]);

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  try {
    const { organizationId, invoiceId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !invoiceId || invoiceId.length > 64) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const invoice = await prisma.invoice.findFirst({
      where: { organizationId, id: invoiceId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        project: { include: { client: { select: { id: true, name: true, email: true, phone: true } } } },
        quotation: { select: { id: true, number: true, status: true } },
        payments: { where: { status: "SETTLEMENT" }, orderBy: { paidAt: "desc" } },
      },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  try {
    const { organizationId, invoiceId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !invoiceId || invoiceId.length > 64) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.FINANCE]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Aksi invoice tidak valid." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { organizationId, id: invoiceId } });
      if (!invoice) return { kind: "not-found" as const };
      if (parsed.data.action === "issue") {
        if (invoice.status !== "DRAFT") return { kind: "conflict" as const };
        const changed = await tx.invoice.updateMany({ where: { organizationId, id: invoiceId, status: "DRAFT" }, data: { status: "SENT", issuedAt: new Date() } });
        if (changed.count !== 1) return { kind: "conflict" as const };
      } else {
        if (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID" || invoice.paidAmount.greaterThan(0) || invoice.status === "VOID") return { kind: "conflict" as const };
        const changed = await tx.invoice.updateMany({ where: { organizationId, id: invoiceId, status: invoice.status, paidAmount: new Prisma.Decimal(0) }, data: { status: "VOID" } });
        if (changed.count !== 1) return { kind: "conflict" as const };
      }
      const updated = await tx.invoice.findFirst({ where: { organizationId, id: invoiceId } });
      if (!updated) return { kind: "not-found" as const };
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: parsed.data.action === "issue" ? "invoice.issued" : "invoice.voided",
          entityType: "Invoice", entityId: invoiceId,
          beforeState: { status: invoice.status }, afterState: { status: updated.status },
        },
      });
      return { kind: "updated" as const, invoice: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Status invoice tidak memungkinkan aksi ini." }, { status: 409 });
    return NextResponse.json({ invoice: result.invoice });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
