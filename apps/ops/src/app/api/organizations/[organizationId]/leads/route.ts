import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const leadSchema = z.object({
  title: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  clientId: z.string().trim().min(1).max(64).nullable().optional(),
  phone: z.union([z.string().trim().min(5).max(32), z.literal("")]).optional().transform((value) => value || null),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().transform((value) => value ? value.toLowerCase() : null),
  source: z.string().trim().max(80).nullable().optional(),
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  estimatedValue: z.number().finite().min(0).max(999999999999).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

async function readJson(request: NextRequest, limit = 8_192): Promise<unknown> {
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

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      return NextResponse.json({ error: "Parameter limit harus berupa bilangan bulat antara 1 dan 100." }, { status: 400 });
    }
    const stage = url.searchParams.get("stage");
    if (stage && !["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"].includes(stage)) {
      return NextResponse.json({ error: "Tahap lead tidak valid." }, { status: 400 });
    }
    const leads = await prisma.lead.findMany({
      where: { organizationId, ...(stage ? { stage } : {}) },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: requestedLimit + 1,
    });
    const hasMore = leads.length > requestedLimit;
    return NextResponse.json({
      leads: hasMore ? leads.slice(0, requestedLimit) : leads,
      pagination: { limit: requestedLimit, hasMore },
    });
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
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data lead tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      if (input.clientId) {
        const client = await tx.client.findUnique({
          where: { organizationId_id: { organizationId, id: input.clientId } },
          select: { id: true },
        });
        if (!client) return { kind: "client-not-found" as const };
      }
      const lead = await tx.lead.create({
        data: {
          organizationId,
          clientId: input.clientId ?? null,
          title: input.title,
          contactName: input.contactName,
          phone: input.phone,
          email: input.email,
          source: input.source || null,
          stage: input.stage ?? "NEW",
          estimatedValue: input.estimatedValue == null ? null : new Prisma.Decimal(input.estimatedValue),
          followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
        },
        include: { client: { select: { id: true, name: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "lead.created",
          entityType: "Lead",
          entityId: lead.id,
          afterState: {
            title: lead.title,
            contactName: lead.contactName,
            clientId: lead.clientId,
            stage: lead.stage,
            estimatedValue: input.estimatedValue ?? null,
          },
        },
      });
      return { kind: "created" as const, lead };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "client-not-found") {
      return NextResponse.json({ error: "Klien tidak ditemukan pada organisasi ini." }, { status: 404 });
    }
    return NextResponse.json({ lead: result.lead }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
