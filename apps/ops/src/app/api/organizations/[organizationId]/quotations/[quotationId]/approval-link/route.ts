import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";
import { sendTransactionalEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, context: { params: Promise<{ organizationId: string; quotationId: string }> }) {
  try {
    const { organizationId, quotationId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !quotationId || quotationId.length > 64) {
      return NextResponse.json({ error: "ID organisasi atau quotation tidak valid." }, { status: 400 });
    }
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) return NextResponse.json({ error: "URL aplikasi belum dikonfigurasi." }, { status: 503 });
    const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
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
      const changed = await tx.quotation.updateMany({
        where: { organizationId, id: quotationId, status: "SENT" },
        data: { approvalTokenHash: tokenHash, approvalTokenExpiresAt: expiresAt, approvalTokenUsedAt: null },
      });
      if (changed.count !== 1) return { kind: "invalid-status" as const };
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "quotation.approval_link.created",
          entityType: "Quotation", entityId: quotationId,
          metadata: { expiresAt: expiresAt.toISOString(), delivery: emailConfigured && quotation.client.email ? "email" : "manual" },
        },
      });
      return { kind: "created" as const, number: quotation.number, clientEmail: quotation.client.email };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Quotation tidak ditemukan." }, { status: 404 });
    if (result.kind === "invalid-status") return NextResponse.json({ error: "Link persetujuan hanya dapat dibuat untuk quotation berstatus SENT." }, { status: 409 });
    const approvalUrl = new URL(`/approval/${rawToken}`, baseUrl).toString();
    if (emailConfigured && result.clientEmail) {
      const safeNumber = result.number.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
      const delivery = await sendTransactionalEmail({
        to: result.clientEmail,
        subject: `Persetujuan penawaran ${result.number} — Dzaroza Property`,
        text: `Halo, silakan tinjau dan berikan keputusan untuk penawaran ${result.number}: ${approvalUrl}. Tautan berlaku selama tujuh hari dan hanya dapat digunakan sekali.`,
        html: `<p>Halo,</p><p>Penawaran <strong>${safeNumber}</strong> dari Dzaroza Property siap ditinjau.</p><p><a href="${approvalUrl}">Tinjau dan berikan keputusan</a></p><p>Tautan berlaku tujuh hari dan hanya dapat digunakan sekali. Jika Anda tidak mengharapkan email ini, abaikan pesan ini.</p>`,
      });
      if (!delivery.sent) {
        await prisma.$transaction(async (tx) => {
          await tx.quotation.updateMany({
            where: { organizationId, id: quotationId, approvalTokenHash: tokenHash, status: "SENT" },
            data: { approvalTokenHash: null, approvalTokenExpiresAt: null, approvalTokenUsedAt: null },
          });
          await tx.auditLog.create({
            data: { organizationId, actorId: actor.userId, action: "quotation.approval_email.failed", entityType: "Quotation", entityId: quotationId, metadata: { reason: delivery.reason, providerStatus: "status" in delivery ? delivery.status : null } },
          });
        });
        return NextResponse.json({ error: "Email persetujuan gagal dikirim. Token dibatalkan; silakan coba kembali setelah konfigurasi email diperiksa." }, { status: 502 });
      }
      return NextResponse.json({
        approval: { quotationNumber: result.number, clientEmail: result.clientEmail, delivery: "email", expiresAt: expiresAt.toISOString() },
        message: "Tautan persetujuan telah dikirim ke email klien.",
      }, { status: 201, headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({
      approval: {
        quotationNumber: result.number,
        clientEmail: result.clientEmail,
        url: approvalUrl,
        expiresAt: expiresAt.toISOString(),
        delivery: "manual",
      },
      notice: "Email otomatis belum dikonfigurasi atau email klien tidak tersedia. Kirim tautan ini secara manual melalui kanal terverifikasi; tautan hanya ditampilkan sekali.",
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
