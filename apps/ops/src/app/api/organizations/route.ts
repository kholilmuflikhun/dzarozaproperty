import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma, MembershipRole } from "@dzaroza/database";
import { requireUserId, toHttpError } from "@/lib/tenant";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  legalName: z.string().trim().max(160).optional(),
});
function makeSlug(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "organization";
  return `${base}-${randomUUID().slice(0, 8)}`;
}
export async function GET() {
  try {
    const userId = await requireUserId();
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true, slug: true, currency: true, timezone: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ organizations: memberships.map(({ organization, role }) => ({ ...organization, role })) });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (Number(request.headers.get("content-length") ?? 0) > 8_192) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Data organisasi tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: parsed.data.name, legalName: parsed.data.legalName, slug: makeSlug(parsed.data.name) },
      });
      await tx.membership.create({ data: { organizationId: created.id, userId, role: MembershipRole.OWNER } });
      await tx.auditLog.create({
        data: { organizationId: created.id, actorId: userId, action: "organization.created", entityType: "Organization", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
