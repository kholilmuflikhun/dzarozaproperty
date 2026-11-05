import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const itemSchema = z.object({
  description: z.string().trim().min(2).max(500),
  quantity: z.number().finite().positive().max(1_000_000).multipleOf(0.001),
  unit: z.string().trim().min(1).max(24),
  unitPrice: z.number().finite().min(0).max(999_999_999_999).multipleOf(0.01),
  category: z.enum(["WORK", "MATERIAL", "SERVICE"]).optional().default("WORK"),
});
const termSchema = z.object({
  name: z.string().trim().min(2).max(80),
  condition: z.string().trim().min(2).max(500),
  percentage: z.number().finite().positive().max(100).multipleOf(0.01),
  dueAt: z.string().datetime().nullable().optional(),
});
const workspaceSchema = z.object({
  workspace: z.object({
    businessName: z.string().trim().max(160).nullable().optional(),
    businessAddress: z.string().trim().max(500).nullable().optional(),
    businessPhone: z.string().trim().max(40).nullable().optional(),
    businessEmail: z.string().trim().email().max(160).nullable().optional(),
    businessOwnerName: z.string().trim().max(160).nullable().optional(),
    clientAddress: z.string().trim().max(500).nullable().optional(),
    siteAddress: z.string().trim().max(500).nullable().optional(),
    quotationDate: z.string().datetime().nullable().optional(),
    quotationValidDays: z.number().int().min(1).max(365).optional(),
    spkSignedAt: z.string().datetime().nullable().optional(),
    durationDays: z.number().int().min(1).max(3650).nullable().optional(),
    documentSequence: z.number().int().min(1).max(999999).optional(),
    bankName: z.string().trim().max(100).nullable().optional(),
    bankAccountNumber: z.string().trim().max(80).nullable().optional(),
    bankAccountName: z.string().trim().max(160).nullable().optional(),
    maintenanceDays: z.number().int().min(0).max(3650).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  }).optional().default({}),
  workItems: z.array(itemSchema).max(200).optional().default([]),
  paymentTerms: z.array(termSchema).max(20).optional().default([]),
}).strict().superRefine((value, context) => {
  if (value.paymentTerms.length > 0) {
    const total = value.paymentTerms.reduce((sum, term) => sum + term.percentage, 0);
    if (Math.abs(total - 100) > 0.001) {
      context.addIssue({ code: "custom", path: ["paymentTerms"], message: "Total persentase termin harus tepat 100%." });
    }
  }
});

function validIds(organizationId: string, projectId: string) {
  return organizationId.length > 0 && organizationId.length <= 64 && projectId.length > 0 && projectId.length <= 64;
}
function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    if (!validIds(organizationId, projectId)) return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const project = await prisma.project.findFirst({
      where: { organizationId, id: projectId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        workspace: true,
        workItems: { orderBy: { sortOrder: "asc" } },
        paymentTerms: { orderBy: { sequence: "asc" } },
        changeOrders: { include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" } },
        progressReports: { orderBy: { weekStart: "desc" }, take: 20 },
      },
    });
    if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ workspace: serialize(project) });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    if (!validIds(organizationId, projectId)) return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER,
    ]);
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const parsed = workspaceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data workspace tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const workItems = input.workItems.map((item, index) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return { ...item, quantity, unitPrice, lineTotal: quantity.mul(unitPrice).toDecimalPlaces(2), sortOrder: index };
    });
    const baseValue = workItems.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
    if (baseValue.greaterThan("999999999999.99")) {
      return NextResponse.json({ error: "Total rincian pekerjaan melebihi batas nominal." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { organizationId, id: projectId }, select: { id: true, status: true, contractValue: true } });
      if (!project) return null;
      const existingInvoice = await tx.invoice.findFirst({ where: { organizationId, projectId }, select: { id: true } });
      if (existingInvoice) return { kind: "invoices-locked" as const };
      const rawWorkspace = input.workspace;
      const workspaceData = {
        ...rawWorkspace,
        quotationDate: rawWorkspace.quotationDate === undefined ? undefined : rawWorkspace.quotationDate ? new Date(rawWorkspace.quotationDate) : null,
        spkSignedAt: rawWorkspace.spkSignedAt === undefined ? undefined : rawWorkspace.spkSignedAt ? new Date(rawWorkspace.spkSignedAt) : null,
      };
      const workspace = await tx.projectWorkspace.upsert({
        where: { organizationId_projectId: { organizationId, projectId } },
        create: { organizationId, projectId, ...workspaceData },
        update: workspaceData,
      });
      await tx.projectWorkItem.deleteMany({ where: { organizationId, projectId } });
      if (workItems.length) {
        await tx.projectWorkItem.createMany({
          data: workItems.map((item) => ({ organizationId, projectId, ...item })),
        });
      }
      const invoicedTerm = await tx.paymentTerm.findFirst({ where: { organizationId, projectId, invoiceId: { not: null } }, select: { id: true } });
      if (invoicedTerm) return { kind: "terms-locked" as const };
      await tx.paymentTerm.deleteMany({ where: { organizationId, projectId } });
      if (input.paymentTerms.length) {
        await tx.paymentTerm.createMany({
          data: input.paymentTerms.map((term, index) => ({
            organizationId, projectId, sequence: index + 1, name: term.name, condition: term.condition,
            percentage: new Prisma.Decimal(term.percentage),
            amount: baseValue.mul(term.percentage).div(100).toDecimalPlaces(2),
            dueAt: term.dueAt ? new Date(term.dueAt) : null,
          })),
        });
      }
      await tx.project.updateMany({
        where: { organizationId, id: projectId },
        data: { contractValue: baseValue },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "project.workspace.updated",
          entityType: "Project", entityId: projectId,
          beforeState: { contractValue: project.contractValue.toString() },
          afterState: { contractValue: baseValue.toString(), workItemCount: workItems.length, paymentTermCount: input.paymentTerms.length },
        },
      });
      return { kind: "saved" as const, workspace, baseValue: baseValue.toString(), workItemCount: workItems.length, paymentTermCount: input.paymentTerms.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!result) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (result.kind === "invoices-locked") return NextResponse.json({ error: "Workspace terkunci setelah invoice dibuat. Untuk menjaga histori kontrak dan tagihan, batalkan seluruh invoice terlebih dahulu sebelum mengubah rincian pekerjaan atau termin." }, { status: 409 });
    if (result.kind === "terms-locked") return NextResponse.json({ error: "Termin sudah memiliki invoice. Untuk menjaga riwayat tagihan, ubah termin hanya setelah invoice terkait diselesaikan atau dibatalkan." }, { status: 409 });
    return NextResponse.json({ result: serialize(result) });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Muat ulang lalu coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
