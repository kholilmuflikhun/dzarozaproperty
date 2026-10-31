import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const clientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().transform((value) => value ? value.toLowerCase() : null),
  phone: z.union([z.string().trim().min(5).max(32), z.literal("")]).optional().transform((value) => value || null),
});

async function readJson(request: NextRequest, limit = 4_096): Promise<unknown> {
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
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

class PayloadTooLargeError extends Error {}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const clients = await prisma.client.findMany({
      where: { organizationId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 100,
    });
    return NextResponse.json({ clients, pagination: { limit: 100, hasMore: clients.length === 100 } });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER,
      MembershipRole.ADMIN,
      MembershipRole.PROJECT_MANAGER,
      MembershipRole.SALES,
    ]);

    let body: unknown;
    try {
      body = await readJson(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
      }
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const parsed = clientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data klien tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          organizationId,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "client.created",
          entityType: "Client",
          entityId: created.id,
          afterState: {
            name: created.name,
            email: created.email,
            phone: created.phone,
          },
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
