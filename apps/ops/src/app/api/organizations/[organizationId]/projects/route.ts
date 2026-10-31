import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, ProjectStatus, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const projectSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  status: z.nativeEnum(ProjectStatus).optional(),
  contractValue: z.number().finite().min(0).max(999999999999),
  progress: z.number().int().min(0).max(100).optional(),
  startAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((value) => !value.startAt || !value.dueAt || new Date(value.dueAt) >= new Date(value.startAt), {
  message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
  path: ["dueAt"],
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

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }
    await requireTenantContext(organizationId);
    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
    return NextResponse.json({ projects, pagination: { limit: 50, hasMore: projects.length === 50 } });
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
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data proyek tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { organizationId_id: { organizationId, id: input.clientId } },
        select: { id: true },
      });
      if (!client) return { kind: "client-not-found" as const };

      const subscription = await tx.subscription.findFirst({
        where: {
          organizationId,
          status: { in: ["ACTIVE", "TRIALING"] },
          currentPeriodEnd: { gt: new Date() },
        },
        include: { plan: { select: { maxProjects: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (!subscription) return { kind: "subscription-required" as const };

      const projectCount = await tx.project.count({ where: { organizationId } });
      const maxProjects = subscription.plan.maxProjects;
      if (maxProjects !== null && projectCount >= maxProjects) {
        return { kind: "project-limit" as const, maxProjects, projectCount };
      }

      const project = await tx.project.create({
        data: {
          organizationId,
          clientId: input.clientId,
          code: input.code,
          name: input.name,
          status: input.status ?? ProjectStatus.DRAFT,
          contractValue: new Prisma.Decimal(input.contractValue),
          progress: input.progress ?? 0,
          startAt: input.startAt ? new Date(input.startAt) : null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        },
        include: { client: { select: { id: true, name: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "project.created",
          entityType: "Project",
          entityId: project.id,
          afterState: {
            clientId: project.clientId,
            code: project.code,
            name: project.name,
            status: project.status,
            contractValue: input.contractValue,
            progress: project.progress,
          },
        },
      });
      return { kind: "created" as const, project };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "client-not-found") {
      return NextResponse.json({ error: "Klien tidak ditemukan pada organisasi ini." }, { status: 404 });
    }
    if (result.kind === "subscription-required") {
      return NextResponse.json({ error: "Langganan aktif diperlukan untuk membuat proyek." }, { status: 402 });
    }
    if (result.kind === "project-limit") {
      return NextResponse.json({ error: "Kuota proyek paket telah tercapai.", limit: result.maxProjects, current: result.projectCount }, { status: 409 });
    }
    return NextResponse.json({ project: result.project }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ error: "Kode proyek sudah digunakan pada organisasi ini." }, { status: 409 });
    }
    if (code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
