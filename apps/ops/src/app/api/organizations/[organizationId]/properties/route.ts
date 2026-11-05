import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, PropertyStatus, PropertyType, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const propertySchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  propertyType: z.nativeEnum(PropertyType),
  status: z.nativeEnum(PropertyStatus).optional().default(PropertyStatus.DRAFT),
  description: z.string().trim().max(4000).nullable().optional(),
  addressLine: z.string().trim().max(500).nullable().optional(),
  village: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().min(2).max(100).optional().default("Indonesia"),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  landArea: z.number().finite().min(0).max(999999999999).nullable().optional(),
  buildingArea: z.number().finite().min(0).max(999999999999).nullable().optional(),
}).strict();

const querySchema = z.object({
  status: z.nativeEnum(PropertyStatus).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(160).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filter properti tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const { limit, cursor, q, ...filters } = parsed.data;
    const properties = await prisma.property.findMany({
      where: { organizationId, ...filters, ...(q ? { OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { addressLine: { contains: q, mode: "insensitive" } },
      ] } : {}) },
      include: { _count: { select: { buildings: true, units: true, assets: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    const hasMore = properties.length > limit;
    if (hasMore) properties.pop();
    const nextCursor = hasMore ? properties.at(-1)?.id ?? null : null;
    return NextResponse.json({ properties, pagination: { limit, hasMore, nextCursor } });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = propertySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data properti tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          organizationId,
          ...input,
          latitude: input.latitude == null ? null : new Prisma.Decimal(input.latitude),
          longitude: input.longitude == null ? null : new Prisma.Decimal(input.longitude),
          landArea: input.landArea == null ? null : new Prisma.Decimal(input.landArea),
          buildingArea: input.buildingArea == null ? null : new Prisma.Decimal(input.buildingArea),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "property.created",
          entityType: "Property", entityId: created.id,
          afterState: { code: created.code, name: created.name, propertyType: created.propertyType, status: created.status },
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode properti sudah digunakan pada organisasi ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
