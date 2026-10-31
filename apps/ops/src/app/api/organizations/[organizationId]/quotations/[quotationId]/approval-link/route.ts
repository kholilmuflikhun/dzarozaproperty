import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, context: { params: Promise<{ organizationId: string; quotationId: string }> }) {
  try {
    const { organizationId, quotationId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !quotationId || quotationId.length > 64) {
      return NextResponse.json({ error: "ID organisasi atau quotation tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER, MembershipRole.SALES,
    ]);
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { organizationId, id: quotationId },
        include: { client: { select: { name: true, email: true } } },
      });
      if (!quotation) return { kind: "not-found" as const };
      if (quotation.status !== "SENT") return { kind: "invalid-status" as const };
      await tx.quotation.updateMany({
        where: { organizationId, id: quotationId, status: "SENT" },
        data: { approvalTokenHash: tokenHash, approvalTokenExpiresAt: expiresAt, approvalTokenUsedAt: null },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "quotation.approval_link.created",
          entityType: "Quotation", entityId: quotationId,
          metadata: { expiresAt: expiresAt.toISOString(), delivery: "manual" },
        },
      });
      return { kind: "created" as const, number: quotation.number, clientEmail: quotation.client.email };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Quotation tidak ditemukan." }, { status: 404 });
    if (result.kind === "invalid-status") return NextResponse.json({ error: "Link persetujuan hanya dapat dibuat untuk quotation berstatus SENT." }, { status: 409 });
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) return NextResponse.json({ error: "URL aplikasi belum dikonfigurasi." }, { status: 503 });
    return NextResponse.json({
      approval: {
        quotationNumber: result.number,
        clientEmail: result.clientEmail,
        url: new URL(`/api/public/quotation-approvals/${rawToken}`, baseUrl).toString(),
        expiresAt: expiresAt.toISOString(),
        delivery: "manual",
      },
      notice: "Kirim tautan ini kepada kontak klien melalui kanal terverifikasi. Tautan hanya ditampilkan sekali.",
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
