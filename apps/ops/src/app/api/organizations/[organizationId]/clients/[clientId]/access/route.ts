import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";

export const runtime = "nodejs";
const grantSchema = z.object({
  membershipId: z.string().trim().min(1).max(64),
  accessType: z.enum(["SALES", "CLIENT_PORTAL"]),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string; clientId: string }> }) {
  try {
    const { organizationId, clientId } = await context.params;
    const actor = await requireTenantContext(organizationId);
    if (actor.role !== "OWNER" && actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Hanya Owner atau Admin yang dapat mengelola akses klien." }, { status: 403 });
    }
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Grant akses tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Klien tidak ditemukan." }, { status: 404 });
    const target = await prisma.membership.findFirst({ where: { id: parsed.data.membershipId, organizationId }, select: { id: true, role: true } });
    const expectedRole = parsed.data.accessType === "SALES" ? "SALES" : "CLIENT";
    if (!target || target.role !== expectedRole) {
      return NextResponse.json({ error: "Anggota tidak memiliki role yang sesuai untuk grant ini." }, { status: 422 });
    }
    const existing = parsed.data.accessType === "SALES"
      ? await prisma.salesClientAccess.findFirst({ where: { organizationId, clientId, membershipId: target.id, status: "ACTIVE" }, select: { id: true } })
      : await prisma.clientPortalAccess.findFirst({ where: { organizationId, clientId, membershipId: target.id, status: "ACTIVE" }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Grant aktif sudah tersedia." }, { status: 409 });
    const grant = parsed.data.accessType === "SALES"
      ? await prisma.salesClientAccess.create({ data: { organizationId, clientId, membershipId: target.id, status: "ACTIVE" }, select: { id: true, status: true } })
      : await prisma.clientPortalAccess.create({ data: { organizationId, clientId, membershipId: target.id, status: "ACTIVE" }, select: { id: true, status: true } });
    await prisma.auditLog.create({
      data: { organizationId, actorId: actor.userId, action: "CLIENT_ACCESS_GRANTED", entityType: parsed.data.accessType === "SALES" ? "SalesClientAccess" : "ClientPortalAccess", entityId: grant.id, afterState: { clientId, membershipId: target.id, accessType: parsed.data.accessType } },
    });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ organizationId: string; clientId: string }> }) {
  try {
    const { organizationId, clientId } = await context.params;
    const actor = await requireTenantContext(organizationId);
    if (actor.role !== "OWNER" && actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Hanya Owner atau Admin yang dapat mengelola akses klien." }, { status: 403 });
    }
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Grant akses tidak valid." }, { status: 400 });
    const model = parsed.data.accessType === "SALES" ? prisma.salesClientAccess : prisma.clientPortalAccess;
    const grant = await model.findFirst({ where: { organizationId, clientId, membershipId: parsed.data.membershipId, status: "ACTIVE" }, select: { id: true } });
    if (!grant) return NextResponse.json({ error: "Grant aktif tidak ditemukan." }, { status: 404 });
    const changed = await model.updateMany({ where: { id: grant.id, organizationId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    if (changed.count !== 1) return NextResponse.json({ error: "Grant berubah; muat ulang dan coba kembali." }, { status: 409 });
    await prisma.auditLog.create({
      data: { organizationId, actorId: actor.userId, action: "CLIENT_ACCESS_REVOKED", entityType: parsed.data.accessType === "SALES" ? "SalesClientAccess" : "ClientPortalAccess", entityId: grant.id, afterState: { status: "REVOKED" } },
    });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
