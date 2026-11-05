import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, PropertyUnitStatus, PropertyUnitType, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()),
  name: z.string().trim().max(160).nullable().optional(),
  buildingId: z.string().trim().min(1).max(64).nullable().optional(),
  unitType: z.nativeEnum(PropertyUnitType),
  status: z.nativeEnum(PropertyUnitStatus).optional().default(PropertyUnitStatus.AVAILABLE),
  floorLabel: z.string().trim().max(40).nullable().optional(),
  area: z.number().finite().min(0).max(999999999999).nullable().optional(),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  bathrooms: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    await requireTenantContext(organizationId);
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    const units = await prisma.propertyUnit.findMany({
      where: { organizationId, propertyId },
      include: { building: { select: { id: true, code: true, name: true } } },
      orderBy: [{ code: "asc" }, { id: "asc" }],
      take: 200,
    });
    return NextResponse.json({ units, pagination: { limit: 200, hasMore: units.length === 200 } });
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
    if (!parsed.success) return NextResponse.json({ error: "Data unit tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (parsed.data.buildingId) {
      const building = await prisma.propertyBuilding.findFirst({ where: { id: parsed.data.buildingId, organizationId, propertyId }, select: { id: true } });
      if (!building) return NextResponse.json({ error: "Gedung tidak ditemukan pada properti ini." }, { status: 404 });
    }
    const { area, ...rest } = parsed.data;
    const unit = await prisma.$transaction(async (tx) => {
      const created = await tx.propertyUnit.create({
        data: { organizationId, propertyId, ...rest, area: area == null ? null : new Prisma.Decimal(area) },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.unit.created",
        entityType: "PropertyUnit", entityId: created.id,
        afterState: { propertyId, buildingId: created.buildingId, code: created.code, unitType: created.unitType },
      } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode unit sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
