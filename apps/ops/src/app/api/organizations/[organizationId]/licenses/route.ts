import { NextResponse } from "next/server";
import { MembershipRole, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const licenses = await prisma.license.findMany({
      where: { organizationId },
      select: {
        id: true, keyPrefix: true, status: true, maxActivations: true, expiresAt: true, createdAt: true,
        _count: { select: { activations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ licenses });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
