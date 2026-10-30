import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, MembershipRole, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantRole, toHttpError } from "@/lib/tenant";
import { hashLicenseSecret, isLicenseEntitled } from "@/lib/licensing";

const schema = z.object({
  licenseKey: z.string().min(30).max(120),
  installationId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  fingerprint: z.string().min(16).max(1024),
  label: z.string().max(80).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    const membership = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    if (Number(request.headers.get("content-length") ?? 0) > 4_096) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Data aktivasi tidak valid." }, { status: 400 });
    const input = parsed.data;
    const license = await prisma.license.findUnique({
      where: { keyHash: hashLicenseSecret(input.licenseKey) },
      include: { subscription: true },
    });
    if (!license || license.organizationId !== organizationId || !license.subscription ||
      !isLicenseEntitled({
        status: license.status,
        expiresAt: license.expiresAt,
        subscriptionStatus: license.subscription.status,
        periodEnd: license.subscription.currentPeriodEnd,
      })) {
      return NextResponse.json({ error: "Lisensi tidak valid atau tidak aktif." }, { status: 404 });
    }

    const fingerprintHash = createHash("sha256").update(input.fingerprint).digest("hex");
    const activation = await prisma.$transaction(async (tx) => {
      const existing = await tx.licenseActivation.findUnique({
        where: { licenseId_installationId: { licenseId: license.id, installationId: input.installationId } },
      });
      if (existing && !existing.revokedAt) {
        return tx.licenseActivation.update({
          where: { id: existing.id },
          data: { fingerprintHash, label: input.label, lastSeenAt: new Date() },
        });
      }
      const activeCount = await tx.licenseActivation.count({
        where: { licenseId: license.id, revokedAt: null },
      });
      if (activeCount >= license.maxActivations) throw new Error("ACTIVATION_LIMIT_REACHED");
      if (existing) {
        return tx.licenseActivation.update({
          where: { id: existing.id },
          data: { fingerprintHash, label: input.label, lastSeenAt: new Date(), revokedAt: null },
        });
      }
      return tx.licenseActivation.create({
        data: {
          licenseId: license.id,
          installationId: input.installationId,
          fingerprintHash,
          label: input.label,
          activatedById: membership.userId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ activationId: activation.id, activatedAt: activation.activatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVATION_LIMIT_REACHED") {
      return NextResponse.json({ error: "Batas aktivasi lisensi telah tercapai." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Konflik aktivasi. Silakan ulangi permintaan." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
