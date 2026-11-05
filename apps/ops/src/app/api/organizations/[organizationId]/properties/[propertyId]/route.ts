import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, PropertyStatus, PropertyType, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const patchSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((value) => value.toUpperCase()).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  status: z.nativeEnum(PropertyStatus).refine((value) => value !== PropertyStatus.ARCHIVED, { message: "Gunakan aksi arsip untuk mengarsipkan properti." }).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  addressLine: z.string().trim().max(500).nullable().optional(),
  village: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().min(2).max(100).optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  landArea: z.number().finite().min(0).max(999999999999).nullable().optional(),
  buildingArea: z.number().finite().min(0).max(999999999999).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Minimal satu kolom harus diubah." });

function validIds(organizationId: string, propertyId: string) {
  return organizationId.length > 0 && organizationId.length <= 64 && propertyId.length > 0 && propertyId.length <= 64;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    if (!validIds(organizationId, propertyId)) return NextResponse.json({ error: "ID organisasi atau properti tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const property = await prisma.property.findFirst({
      where: { organizationId, id: propertyId },
      include: {
        buildings: { orderBy: [{ code: "asc" }, { id: "asc" }] },
        units: { include: { building: { select: { id: true, code: true, name: true } } }, orderBy: [{ code: "asc" }, { id: "asc" }] },
        assets: { include: { building: { select: { id: true, code: true, name: true } } }, orderBy: [{ code: "asc" }, { id: "asc" }] },
        _count: { select: { buildings: true, units: true, assets: true } },
      },
    });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ property });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    if (!validIds(organizationId, propertyId)) return NextResponse.json({ error: "ID organisasi atau properti tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data perubahan properti tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const property = await prisma.$transaction(async (tx) => {
      const current = await tx.property.findFirst({ where: { organizationId, id: propertyId } });
      if (!current) return null;
      if (current.status === PropertyStatus.ARCHIVED) return { archived: true as const };
      const data: Prisma.PropertyUncheckedUpdateInput = {};
      for (const key of ["code", "name", "propertyType", "status", "description", "addressLine", "village", "district", "city", "province", "postalCode", "country"] as const) {
        if (input[key] !== undefined) Object.assign(data, { [key]: input[key] });
      }
      for (const key of ["latitude", "longitude", "landArea", "buildingArea"] as const) {
        if (input[key] !== undefined) Object.assign(data, { [key]: input[key] === null ? null : new Prisma.Decimal(input[key] as number) });
      }
      const updated = await tx.property.update({ where: { organizationId_id: { organizationId, id: propertyId } }, data });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.updated", entityType: "Property", entityId: propertyId,
        beforeState: { code: current.code, name: current.name, status: current.status, city: current.city, propertyType: current.propertyType },
        afterState: { code: updated.code, name: updated.name, status: updated.status, city: updated.city, propertyType: updated.propertyType },
      } });
      return { property: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan." }, { status: 404 });
    if ("archived" in property) return NextResponse.json({ error: "Properti telah diarsipkan dan tidak dapat diubah." }, { status: 409 });
    return NextResponse.json(property);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode properti sudah digunakan pada organisasi ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    if (!validIds(organizationId, propertyId)) return NextResponse.json({ error: "ID organisasi atau properti tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.property.findFirst({ where: { organizationId, id: propertyId } });
      if (!current) return { kind: "not-found" as const };
      if (current.status === PropertyStatus.ARCHIVED) return { kind: "archived" as const, property: current };
      const occupiedUnits = await tx.propertyUnit.count({
        where: { organizationId, propertyId, status: { in: ["OCCUPIED", "RESERVED"] } },
      });
      if (occupiedUnits > 0) return { kind: "occupied" as const, count: occupiedUnits };
      const updated = await tx.property.update({
        where: { organizationId_id: { organizationId, id: propertyId } },
        data: { status: PropertyStatus.ARCHIVED },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.archived", entityType: "Property", entityId: propertyId,
        beforeState: { status: current.status }, afterState: { status: PropertyStatus.ARCHIVED },
      } });
      return { kind: "archived" as const, property: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Properti tidak ditemukan." }, { status: 404 });
    if (result.kind === "occupied") return NextResponse.json({ error: "Properti tidak dapat diarsipkan karena masih memiliki unit terisi atau dipesan.", occupiedUnits: result.count }, { status: 409 });
    return NextResponse.json({ property: result.property, archived: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
