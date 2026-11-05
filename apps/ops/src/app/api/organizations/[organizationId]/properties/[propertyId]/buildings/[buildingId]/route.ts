import { NextRequest, NextResponse } from "next/server";
import { BuildingStatus, MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  status: z.nativeEnum(BuildingStatus).optional(),
  floors: z.number().int().min(0).max(500).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "Minimal satu kolom harus diubah." });

type Context = { params: Promise<{ organizationId: string; propertyId: string; buildingId: string }> };
const valid = (...ids: string[]) => ids.every((id) => id.length > 0 && id.length <= 64);

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, buildingId } = await context.params;
    if (!valid(organizationId, propertyId, buildingId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data gedung tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyBuilding.findFirst({ where: { id: buildingId, organizationId, propertyId } });
      if (!current) return { kind: "not-found" as const };
      if (parsed.data.status === BuildingStatus.INACTIVE || parsed.data.status === BuildingStatus.MAINTENANCE) {
        const occupied = await tx.propertyUnit.count({ where: { organizationId, propertyId, buildingId, status: { in: ["OCCUPIED", "RESERVED"] } } });
        if (occupied) return { kind: "occupied" as const, count: occupied };
      }
      const updated = await tx.propertyBuilding.update({
        where: { organizationId_propertyId_id: { organizationId, propertyId, id: buildingId } },
        data: parsed.data,
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.building.updated", entityType: "PropertyBuilding", entityId: buildingId,
        beforeState: { code: current.code, name: current.name, status: current.status },
        afterState: { code: updated.code, name: updated.name, status: updated.status },
      } });
      return { kind: "updated" as const, building: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Gedung tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "occupied") return NextResponse.json({ error: "Gedung tidak dapat dinonaktifkan karena masih memiliki unit terisi atau dipesan.", occupiedUnits: result.count }, { status: 409 });
    return NextResponse.json({ building: result.building });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode gedung sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, buildingId } = await context.params;
    if (!valid(organizationId, propertyId, buildingId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyBuilding.findFirst({ where: { id: buildingId, organizationId, propertyId } });
      if (!current) return { kind: "not-found" as const };
      if (current.status === BuildingStatus.INACTIVE) return { kind: "inactive" as const, building: current };
      const occupied = await tx.propertyUnit.count({ where: { organizationId, propertyId, buildingId, status: { in: ["OCCUPIED", "RESERVED"] } } });
      if (occupied) return { kind: "occupied" as const, count: occupied };
      const building = await tx.propertyBuilding.update({
        where: { organizationId_propertyId_id: { organizationId, propertyId, id: buildingId } },
        data: { status: BuildingStatus.INACTIVE },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.building.deactivated", entityType: "PropertyBuilding", entityId: buildingId,
        beforeState: { status: current.status }, afterState: { status: BuildingStatus.INACTIVE },
      } });
      return { kind: "inactive" as const, building };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Gedung tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "occupied") return NextResponse.json({ error: "Gedung tidak dapat dinonaktifkan karena masih memiliki unit terisi atau dipesan.", occupiedUnits: result.count }, { status: 409 });
    return NextResponse.json({ building: result.building, deactivated: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
