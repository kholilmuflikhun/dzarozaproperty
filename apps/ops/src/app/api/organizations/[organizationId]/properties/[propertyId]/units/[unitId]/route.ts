import { NextRequest, NextResponse } from "next/server";
import { BuildingStatus, MembershipRole, Prisma, PropertyUnitStatus, PropertyUnitType, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()).optional(),
  name: z.string().trim().max(160).nullable().optional(),
  buildingId: z.string().trim().min(1).max(64).nullable().optional(),
  unitType: z.nativeEnum(PropertyUnitType).optional(),
  status: z.nativeEnum(PropertyUnitStatus).optional(),
  floorLabel: z.string().trim().max(40).nullable().optional(),
  area: z.number().finite().min(0).max(999999999999).nullable().optional(),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  bathrooms: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "Minimal satu kolom harus diubah." });

type Context = { params: Promise<{ organizationId: string; propertyId: string; unitId: string }> };
const valid = (...ids: string[]) => ids.every((id) => id.length > 0 && id.length <= 64);

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, unitId } = await context.params;
    if (!valid(organizationId, propertyId, unitId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data unit tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyUnit.findFirst({ where: { id: unitId, organizationId, propertyId } });
      if (!current) return { kind: "not-found" as const };
      if ((input.status === PropertyUnitStatus.INACTIVE || input.status === PropertyUnitStatus.UNDER_MAINTENANCE) && [PropertyUnitStatus.OCCUPIED, PropertyUnitStatus.RESERVED].includes(current.status)) {
        return { kind: "occupied" as const };
      }
      if (input.buildingId) {
        const building = await tx.propertyBuilding.findFirst({ where: { id: input.buildingId, organizationId, propertyId, status: BuildingStatus.ACTIVE }, select: { id: true } });
        if (!building) return { kind: "building-not-found" as const };
      }
      const { area, ...rest } = input;
      const data: Prisma.PropertyUnitUncheckedUpdateInput = { ...rest };
      if (area !== undefined) data.area = area === null ? null : new Prisma.Decimal(area);
      const unit = await tx.propertyUnit.update({ where: { organizationId_id: { organizationId, id: unitId } }, data });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.unit.updated", entityType: "PropertyUnit", entityId: unitId,
        beforeState: { code: current.code, status: current.status, buildingId: current.buildingId },
        afterState: { code: unit.code, status: unit.status, buildingId: unit.buildingId },
      } });
      return { kind: "updated" as const, unit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Unit tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "building-not-found") return NextResponse.json({ error: "Gedung aktif tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "occupied") return NextResponse.json({ error: "Unit terisi atau dipesan tidak dapat dinonaktifkan atau dijadwalkan pemeliharaan." }, { status: 409 });
    return NextResponse.json({ unit: result.unit });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode unit sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, unitId } = await context.params;
    if (!valid(organizationId, propertyId, unitId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyUnit.findFirst({ where: { id: unitId, organizationId, propertyId } });
      if (!current) return { kind: "not-found" as const };
      if ([PropertyUnitStatus.OCCUPIED, PropertyUnitStatus.RESERVED].includes(current.status)) return { kind: "occupied" as const };
      if (current.status === PropertyUnitStatus.INACTIVE) return { kind: "inactive" as const, unit: current };
      const unit = await tx.propertyUnit.update({
        where: { organizationId_id: { organizationId, id: unitId } }, data: { status: PropertyUnitStatus.INACTIVE },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.unit.deactivated", entityType: "PropertyUnit", entityId: unitId,
        beforeState: { status: current.status }, afterState: { status: PropertyUnitStatus.INACTIVE },
      } });
      return { kind: "inactive" as const, unit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Unit tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "occupied") return NextResponse.json({ error: "Unit terisi atau dipesan tidak dapat dinonaktifkan." }, { status: 409 });
    return NextResponse.json({ unit: result.unit, deactivated: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
