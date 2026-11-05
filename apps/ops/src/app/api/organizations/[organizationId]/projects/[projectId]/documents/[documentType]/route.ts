import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, ProjectDocumentType, prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import { createPresignedUploadUrl, createTenantDocumentKey } from "@/lib/r2-storage";
import { buildProjectDocumentPdf } from "@/lib/project-document-pdf";

const documentTitles: Record<ProjectDocumentType, string> = {
  QUOTATION: "Surat Penawaran Harga",
  WORK_AGREEMENT: "Surat Perjanjian Kerja",
  PAYMENT_SCHEDULE: "Jadwal Termin Pembayaran",
  CHANGE_ORDER: "Berita Acara Kerja Tambah / Kurang",
  PROGRESS_REPORT: "Laporan Progres Pekerjaan",
  INVOICE: "Invoice / Tagihan",
  HANDOVER: "Berita Acara Serah Terima Pekerjaan",
};

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string; documentType: string }> }) {
  try {
    const { organizationId, projectId, documentType } = await context.params;
    if (!organizationId || organizationId.length > 64 || !projectId || projectId.length > 64) {
      return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    }
    if (!Object.values(ProjectDocumentType).includes(documentType as ProjectDocumentType)) {
      return NextResponse.json({ error: "Jenis dokumen tidak dikenal." }, { status: 404 });
    }
    await requireTenantContext(organizationId);
    const type = documentType as ProjectDocumentType;
    const project = await prisma.project.findFirst({
      where: { organizationId, id: projectId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        workspace: true,
        workItems: { orderBy: { sortOrder: "asc" } },
        paymentTerms: { orderBy: { sequence: "asc" } },
        changeOrders: { where: { status: { in: ["APPROVED", "AGREED"] } }, include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "asc" } },
        progressReports: { orderBy: { weekStart: "desc" }, take: 1 },
        invoices: { include: { payments: { where: { status: "PAID" } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const baseValue = Number(project.contractValue);
    const changeOrderNet = project.changeOrders.reduce((sum, order) => sum + Number(order.netTotal), 0);
    const finalValue = baseValue + changeOrderNet;
    const paidAmount = project.invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const outstanding = Math.max(0, finalValue - paidAmount);
    const sequence = String(project.workspace?.documentSequence ?? 1).padStart(3, "0");
    const year = new Date().getFullYear();
    const prefix: Record<ProjectDocumentType, string> = {
      QUOTATION: "PNW", WORK_AGREEMENT: "SPK", PAYMENT_SCHEDULE: "TRM",
      CHANGE_ORDER: "BA-KT", PROGRESS_REPORT: "LP", INVOICE: "INV", HANDOVER: "BAST",
    };
    const number = `${sequence}/${prefix[type]}/${project.code}/${year}`;
    const latestProgress = project.progressReports[0] ?? null;
    const payload = {
      type,
      title: documentTitles[type],
      number,
      generatedAt: new Date().toISOString(),
      organization: {
        name: project.workspace?.businessName ?? "",
        address: project.workspace?.businessAddress ?? "",
        phone: project.workspace?.businessPhone ?? "",
        email: project.workspace?.businessEmail ?? "",
        ownerName: project.workspace?.businessOwnerName ?? "",
        bankName: project.workspace?.bankName ?? "",
        bankAccountNumber: project.workspace?.bankAccountNumber ?? "",
        bankAccountName: project.workspace?.bankAccountName ?? "",
      },
      project: {
        id: project.id, code: project.code, name: project.name, status: project.status,
        startAt: project.startAt, dueAt: project.dueAt, progress: project.progress,
        durationDays: project.workspace?.durationDays ?? null,
        maintenanceDays: project.workspace?.maintenanceDays ?? 30,
        quotationDate: project.workspace?.quotationDate ?? project.createdAt,
        quotationValidDays: project.workspace?.quotationValidDays ?? 14,
        spkSignedAt: project.workspace?.spkSignedAt,
        siteAddress: project.workspace?.siteAddress ?? "",
        notes: project.workspace?.notes ?? "",
      },
      client: { ...project.client, address: project.workspace?.clientAddress ?? "" },
      currency: "IDR",
      workItems: project.workItems.map((item) => ({
        description: item.description, quantity: Number(item.quantity), unit: item.unit,
        unitPrice: Number(item.unitPrice), lineTotal: Number(item.lineTotal), category: item.category,
      })),
      paymentTerms: project.paymentTerms.map((term) => ({
        sequence: term.sequence, name: term.name, condition: term.condition,
        percentage: Number(term.percentage), amount: Number(term.amount), status: term.status, dueAt: term.dueAt,
      })),
      changeOrders: project.changeOrders.map((order) => ({
        number: order.number, reason: order.reason, notes: order.notes,
        addedTotal: Number(order.addedTotal), deductedTotal: Number(order.deductedTotal), netTotal: Number(order.netTotal),
        items: order.items.map((item) => ({ kind: item.kind, description: item.description, quantity: Number(item.quantity), unit: item.unit, unitPrice: Number(item.unitPrice), lineTotal: Number(item.lineTotal) })),
      })),
      latestProgress: latestProgress ? {
        reportNumber: latestProgress.reportNumber, weekStart: latestProgress.weekStart, weekEnd: latestProgress.weekEnd,
        overallProgress: latestProgress.overallProgress, completedItems: latestProgress.completedItems,
        nextWeekPlans: latestProgress.nextWeekPlans, blockers: latestProgress.blockers,
        clientDecision: latestProgress.clientDecision, paymentStatus: latestProgress.paymentStatus,
      } : null,
      invoices: project.invoices.map((invoice) => ({
        number: invoice.number, status: invoice.status, total: Number(invoice.total),
        paidAmount: Number(invoice.paidAmount), dueAt: invoice.dueAt,
      })),
      totals: {
        subtotal: baseValue,
        changeOrderNet,
        finalValue,
        paidAmount,
        outstanding,
      },
    };
    return NextResponse.json({ document: payload });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string; documentType: string }> }) {
  try {
    const { organizationId, projectId, documentType } = await context.params;
    const type = documentType as ProjectDocumentType;
    if (!Object.values(ProjectDocumentType).includes(type)) {
      return NextResponse.json({ error: "Jenis dokumen tidak dikenal." }, { status: 404 });
    }
    const actor = await requireTenantContext(organizationId);
    const previewResponse = await GET(request, context);
    if (!previewResponse.ok) return previewResponse;
    const previewBody = await previewResponse.json();
    const snapshot = previewBody.document;
    const pdf = buildProjectDocumentPdf(snapshot);
    const checksumSha256 = createHash("sha256").update(pdf).digest("hex");
    const safeNumber = String(snapshot.number).replace(/[^a-zA-Z0-9_-]+/g, "-");
    const fileName = `${type.toLowerCase()}-${safeNumber}.pdf`;
    const objectKey = createTenantDocumentKey(organizationId, fileName);
    const signed = await createPresignedUploadUrl(objectKey, 300, "application/pdf");
    const uploadResponse = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body: new Uint8Array(pdf),
      cache: "no-store",
    });
    if (!uploadResponse.ok) {
      return NextResponse.json({ error: "Gagal menyimpan PDF ke arsip privat." }, { status: 502 });
    }
    const parent = await prisma.document.findFirst({
      where: {
        organizationId, projectId, documentType: type,
        documentNumber: snapshot.number, status: "AVAILABLE", deletedAt: null,
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    const document = await prisma.document.create({
      data: {
        organizationId,
        projectId,
        uploadedById: actor.userId,
        fileName,
        objectKey,
        contentType: "application/pdf",
        sizeBytes: BigInt(pdf.byteLength),
        checksumSha256,
        etag: uploadResponse.headers.get("etag"),
        status: "AVAILABLE",
        documentType: type,
        documentNumber: snapshot.number,
        parentDocumentId: parent?.id ?? null,
        version: parent ? parent.version + 1 : 1,
        metadata: {
          source: "PROJECT_DOCUMENT_TEMPLATE",
          generatedAt: snapshot.generatedAt,
          snapshot: snapshot as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true, fileName: true, documentType: true, documentNumber: true,
        version: true, sizeBytes: true, checksumSha256: true, createdAt: true,
      },
    });
    return NextResponse.json({
      document: { ...document, sizeBytes: document.sizeBytes.toString() },
      message: "PDF berhasil dibuat dan diarsipkan.",
    }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002" || code === "P2034") {
      return NextResponse.json(
        { error: "Dokumen baru saja diperbarui oleh proses lain. Muat ulang arsip sebelum membuat dokumen berikutnya." },
        { status: 409 },
      );
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
