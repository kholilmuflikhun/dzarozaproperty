import { NextRequest, NextResponse } from "next/server";
import { BuildingStatus, MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  status: z.nativeEnum(BuildingStatus).optional().default(BuildingStatus.ACTIVE),
  floors: z.number().int().min(0).max(500).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    await requireTenantContext(organizationId);
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    const buildings = await prisma.propertyBuilding.findMany({
      where: { organizationId, propertyId },
      include: { _count: { select: { units: true, assets: true } } },
      orderBy: [{ code: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ buildings });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data gedung tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    const building = await prisma.$transaction(async (tx) => {
      const created = await tx.propertyBuilding.create({ data: { organizationId, propertyId, ...parsed.data } });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.building.created",
        entityType: "PropertyBuilding", entityId: created.id,
        afterState: { propertyId, code: created.code, name: created.name },
      } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ building }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode gedung sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
