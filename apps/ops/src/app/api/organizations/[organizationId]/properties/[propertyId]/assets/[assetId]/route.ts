import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, PropertyAssetStatus, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  buildingId: z.string().trim().min(1).max(64).nullable().optional(),
  status: z.nativeEnum(PropertyAssetStatus).optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  locationLabel: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  purchaseCost: z.number().finite().min(0).max(999999999999.99).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "Minimal satu kolom harus diubah." });

type Context = { params: Promise<{ organizationId: string; propertyId: string; assetId: string }> };
const valid = (...ids: string[]) => ids.every((id) => id.length > 0 && id.length <= 64);

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, assetId } = await context.params;
    if (!valid(organizationId, propertyId, assetId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data aset tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyAsset.findFirst({ where: { id: assetId, organizationId, propertyId } });
      if (!current) return { kind: "not-found" as const };
      if (input.buildingId) {
        const building = await tx.propertyBuilding.findFirst({ where: { id: input.buildingId, organizationId, propertyId }, select: { id: true } });
        if (!building) return { kind: "building-not-found" as const };
      }
      const { acquiredAt, purchaseCost, ...rest } = input;
      const data: Prisma.PropertyAssetUncheckedUpdateInput = { ...rest };
      if (acquiredAt !== undefined) data.acquiredAt = acquiredAt === null ? null : new Date(acquiredAt);
      if (purchaseCost !== undefined) data.purchaseCost = purchaseCost === null ? null : new Prisma.Decimal(purchaseCost);
      const asset = await tx.propertyAsset.update({ where: { organizationId_id: { organizationId, id: assetId } }, data });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.asset.updated", entityType: "PropertyAsset", entityId: assetId,
        beforeState: { code: current.code, name: current.name, status: current.status, buildingId: current.buildingId },
        afterState: { code: asset.code, name: asset.name, status: asset.status, buildingId: asset.buildingId },
      } });
      return { kind: "updated" as const, asset };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Aset tidak ditemukan pada properti ini." }, { status: 404 });
    if (result.kind === "building-not-found") return NextResponse.json({ error: "Gedung tidak ditemukan pada properti ini." }, { status: 404 });
    return NextResponse.json({ asset: result.asset });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode aset sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { organizationId, propertyId, assetId } = await context.params;
    if (!valid(organizationId, propertyId, assetId)) return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.propertyAsset.findFirst({ where: { id: assetId, organizationId, propertyId } });
      if (!current) return null;
      if (current.status === PropertyAssetStatus.RETIRED) return current;
      const asset = await tx.propertyAsset.update({
        where: { organizationId_id: { organizationId, id: assetId } }, data: { status: PropertyAssetStatus.RETIRED },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.asset.retired", entityType: "PropertyAsset", entityId: assetId,
        beforeState: { status: current.status }, afterState: { status: PropertyAssetStatus.RETIRED },
      } });
      return asset;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) return NextResponse.json({ error: "Aset tidak ditemukan pada properti ini." }, { status: 404 });
    return NextResponse.json({ asset: result, retired: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
