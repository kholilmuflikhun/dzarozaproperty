import { NextResponse } from "next/server";
import { MembershipRole, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

export async function DELETE(_request: Request, context: { params: Promise<{ organizationId: string; activationId: string }> }) {
  try {
    const { organizationId, activationId } = await context.params;
    const membership = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const activation = await prisma.licenseActivation.findFirst({
      where: { id: activationId, license: { organizationId } },
      select: { id: true, revokedAt: true },
    });
    if (!activation) return NextResponse.json({ error: "Aktivasi tidak ditemukan." }, { status: 404 });
    if (!activation.revokedAt) {
      await prisma.$transaction([
        prisma.licenseActivation.update({ where: { id: activation.id }, data: { revokedAt: new Date() } }),
        prisma.auditLog.create({
          data: { organizationId, actorId: membership.userId, action: "license.activation_revoked", entityType: "LicenseActivation", entityId: activation.id },
        }),
      ]);
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
