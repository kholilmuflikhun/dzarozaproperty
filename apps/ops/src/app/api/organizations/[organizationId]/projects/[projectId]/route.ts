import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, ProjectStatus, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const patchSchema = z.object({
  clientId: z.string().trim().min(1).max(64).optional(),
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).transform((value) => value.toUpperCase()).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  contractValue: z.number().finite().min(0).max(999999999999).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Minimal satu kolom harus diubah." });

class PayloadTooLargeError extends Error {}

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

function validIds(organizationId: string, projectId: string) {
  return organizationId.length > 0 && organizationId.length <= 64 && projectId.length > 0 && projectId.length <= 64;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    if (!validIds(organizationId, projectId)) return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    await requireTenantContext(organizationId);
    const project = await prisma.project.findFirst({
      where: { organizationId, id: projectId },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    if (!validIds(organizationId, projectId)) return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER]);
    let body: unknown;
    try {
      body = await readJson(request);
    } catch (error) {
      return NextResponse.json({ error: error instanceof PayloadTooLargeError ? "Payload terlalu besar." : "Payload JSON tidak valid." }, { status: error instanceof PayloadTooLargeError ? 413 : 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Data perubahan proyek tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.project.findFirst({ where: { organizationId, id: projectId } });
      if (!current) return { kind: "not-found" as const };
      if (input.clientId) {
        const client = await tx.client.findUnique({ where: { organizationId_id: { organizationId, id: input.clientId } }, select: { id: true } });
        if (!client) return { kind: "client-not-found" as const };
      }
      const startAt = input.startAt === undefined ? current.startAt : input.startAt === null ? null : new Date(input.startAt);
      const dueAt = input.dueAt === undefined ? current.dueAt : input.dueAt === null ? null : new Date(input.dueAt);
      if (startAt && dueAt && dueAt < startAt) return { kind: "invalid-dates" as const };

      const data: Prisma.ProjectUncheckedUpdateManyInput = {};
      if (input.clientId !== undefined) data.clientId = input.clientId;
      if (input.code !== undefined) data.code = input.code;
      if (input.name !== undefined) data.name = input.name;
      if (input.status !== undefined) data.status = input.status;
      if (input.contractValue !== undefined) data.contractValue = new Prisma.Decimal(input.contractValue);
      if (input.progress !== undefined) data.progress = input.progress;
      if (input.startAt !== undefined) data.startAt = startAt;
      if (input.dueAt !== undefined) data.dueAt = dueAt;

      await tx.project.updateMany({ where: { organizationId, id: projectId }, data });
      const project = await tx.project.findFirst({
        where: { organizationId, id: projectId },
        include: { client: { select: { id: true, name: true } } },
      });
      if (!project) return { kind: "not-found" as const };
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "project.updated",
          entityType: "Project",
          entityId: projectId,
          beforeState: { clientId: current.clientId, code: current.code, name: current.name, status: current.status, progress: current.progress },
          afterState: { clientId: project.clientId, code: project.code, name: project.name, status: project.status, progress: project.progress },
        },
      });
      return { kind: "updated" as const, project };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "not-found") return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (result.kind === "client-not-found") return NextResponse.json({ error: "Klien tidak ditemukan pada organisasi ini." }, { status: 404 });
    if (result.kind === "invalid-dates") return NextResponse.json({ error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." }, { status: 400 });
    return NextResponse.json({ project: result.project });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode proyek sudah digunakan pada organisasi ini." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    if (!validIds(organizationId, projectId)) return NextResponse.json({ error: "ID organisasi atau proyek tidak valid." }, { status: 400 });
    const actor = await requireTenantRole(organizationId, [MembershipRole.OWNER, MembershipRole.ADMIN]);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.project.findFirst({ where: { organizationId, id: projectId } });
      if (!current) return null;
      if (current.status === ProjectStatus.ARCHIVED) return current;
      await tx.project.updateMany({ where: { organizationId, id: projectId }, data: { status: ProjectStatus.ARCHIVED } });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: actor.userId,
          action: "project.archived",
          entityType: "Project",
          entityId: projectId,
          beforeState: { status: current.status },
          afterState: { status: ProjectStatus.ARCHIVED },
        },
      });
      return { ...current, status: ProjectStatus.ARCHIVED };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ project: result, archived: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan data bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
