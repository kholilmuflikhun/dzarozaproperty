import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, PropertyAssetStatus, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const schema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  buildingId: z.string().trim().min(1).max(64).nullable().optional(),
  status: z.nativeEnum(PropertyAssetStatus).optional().default(PropertyAssetStatus.ACTIVE),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  locationLabel: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  purchaseCost: z.number().finite().min(0).max(999999999999.99).nullable().optional(),
}).strict();

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    const { organizationId, propertyId } = await context.params;
    await requireTenantContext(organizationId);
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    const assets = await prisma.propertyAsset.findMany({
      where: { organizationId, propertyId },
      include: { building: { select: { id: true, code: true, name: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
    });
    return NextResponse.json({ assets, pagination: { limit: 200, hasMore: assets.length === 200 } });
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
    if (!parsed.success) return NextResponse.json({ error: "Data aset tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Properti tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (parsed.data.buildingId) {
      const building = await prisma.propertyBuilding.findFirst({ where: { id: parsed.data.buildingId, organizationId, propertyId }, select: { id: true } });
      if (!building) return NextResponse.json({ error: "Gedung tidak ditemukan pada properti ini." }, { status: 404 });
    }
    const { acquiredAt, purchaseCost, ...rest } = parsed.data;
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.propertyAsset.create({
        data: {
          organizationId, propertyId, ...rest,
          acquiredAt: acquiredAt ? new Date(acquiredAt) : null,
          purchaseCost: purchaseCost == null ? null : new Prisma.Decimal(purchaseCost),
        },
      });
      await tx.auditLog.create({ data: {
        organizationId, actorId: actor.userId, action: "property.asset.created",
        entityType: "PropertyAsset", entityId: created.id,
        afterState: { propertyId, buildingId: created.buildingId, code: created.code, category: created.category },
      } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode aset sudah digunakan pada properti ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
