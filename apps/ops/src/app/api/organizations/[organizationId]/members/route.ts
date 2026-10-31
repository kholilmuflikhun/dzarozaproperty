import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

const memberSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "FINANCE", "SALES", "STAFF", "CLIENT"]),
});

async function readLimitedJson(request: NextRequest, limit = 4_096): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > limit) throw new PayloadTooLargeError();
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(decoded);
}

class PayloadTooLargeError extends Error {}
class InvalidPayloadError extends Error {}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    if (actor.role === MembershipRole.ADMIN) {
      // Organization admins may manage ordinary seats but cannot grant admin privileges.
    }
    let body: unknown;
    try {
      body = await readLimitedJson(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const parsed = memberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data anggota tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }
    if (actor.role === MembershipRole.ADMIN && parsed.data.role === "ADMIN") {
      return NextResponse.json({ error: "Hanya OWNER yang dapat memberikan peran ADMIN." }, { status: 403 });
    }

    const email = parsed.data.email.toLowerCase();
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
      if (!user) return { kind: "user-not-found" as const };

      const existing = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId: user.id } },
        select: { id: true },
      });
      if (existing) return { kind: "already-member" as const };

      const subscription = await tx.subscription.findFirst({
        where: {
          organizationId,
          status: { in: ["ACTIVE", "TRIALING"] },
          currentPeriodEnd: { gt: new Date() },
        },
        include: { plan: { select: { maxUsers: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (!subscription) return { kind: "subscription-required" as const };

      const memberCount = await tx.membership.count({ where: { organizationId } });
      const maxUsers = subscription.plan.maxUsers;
      if (maxUsers !== null && memberCount >= maxUsers) {
        return { kind: "seat-limit" as const, maxUsers, memberCount };
      }

      const membership = await tx.membership.create({
        data: { organizationId, userId: user.id, role: parsed.data.role as MembershipRole },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "membership.created",
          entityType: "Membership",
          entityId: membership.id,
          afterState: { userId: user.id, email: user.email, role: parsed.data.role },
        },
      });
      return { kind: "created" as const, membership };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "user-not-found") return NextResponse.json({ error: "Akun pengguna belum terdaftar. Pengguna harus membuat akun terlebih dahulu." }, { status: 404 });
    if (result.kind === "already-member") return NextResponse.json({ error: "Pengguna sudah menjadi anggota organisasi." }, { status: 409 });
    if (result.kind === "subscription-required") return NextResponse.json({ error: "Langganan aktif diperlukan untuk menambahkan anggota." }, { status: 402 });
    if (result.kind === "seat-limit") return NextResponse.json({ error: "Kuota anggota paket telah tercapai.", limit: result.maxUsers, current: result.memberCount }, { status: 409 });
    return NextResponse.json({ membership: result.membership }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Keanggotaan sudah ada." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
