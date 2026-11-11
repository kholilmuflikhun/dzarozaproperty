import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";

export const runtime = "nodejs";

const assignmentSchema = z.object({
  membershipId: z.string().trim().min(1).max(64),
  assignmentRole: z.enum(["PROJECT_MANAGER", "CONTRIBUTOR", "VIEWER"]),
}).strict();

const revokeSchema = z.object({ membershipId: z.string().trim().min(1).max(64) }).strict();

async function resolveProjectAccess(organizationId: string, projectId: string, actor: Awaited<ReturnType<typeof requireTenantContext>>) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: {
      id: true,
      assignments: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } },
    },
  });
  if (!project) return { project: null, allowed: false };
  const elevated = actor.role === "OWNER" || actor.role === "ADMIN";
  const assignedPm = actor.role === "PROJECT_MANAGER" && project.assignments.length > 0;
  return { project, allowed: elevated || assignedPm };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    const actor = await requireTenantContext(organizationId);
    const access = await resolveProjectAccess(organizationId, projectId, actor);
    if (!access.project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Akses pengelolaan assignment tidak diizinkan." }, { status: 403 });
    const assignments = await prisma.projectAssignment.findMany({
      where: { organizationId, projectId },
      select: {
        id: true, membershipId: true, assignmentRole: true, status: true, createdAt: true, revokedAt: true,
        membership: { select: { userId: true, role: true, user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ assignments });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    const actor = await requireTenantContext(organizationId);
    const access = await resolveProjectAccess(organizationId, projectId, actor);
    if (!access.project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Akses pengelolaan assignment tidak diizinkan." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Assignment tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
    if (actor.role === "PROJECT_MANAGER" && parsed.data.assignmentRole === "PROJECT_MANAGER") {
      return NextResponse.json({ error: "Project Manager tidak dapat menetapkan Project Manager lain." }, { status: 403 });
    }
    const target = await prisma.membership.findFirst({
      where: { id: parsed.data.membershipId, organizationId },
      select: { id: true, role: true },
    });
    if (!target || target.role === "OWNER" || target.role === "ADMIN" || target.role === "CLIENT") {
      return NextResponse.json({ error: "Keanggotaan target tidak valid untuk assignment proyek." }, { status: 422 });
    }
    if (parsed.data.assignmentRole === "PROJECT_MANAGER" && target.role !== "PROJECT_MANAGER") {
      return NextResponse.json({ error: "Assignment PROJECT_MANAGER hanya untuk anggota dengan role PROJECT_MANAGER." }, { status: 422 });
    }
    if (parsed.data.assignmentRole === "CONTRIBUTOR" && !["STAFF", "PROJECT_MANAGER"].includes(target.role)) {
      return NextResponse.json({ error: "Assignment CONTRIBUTOR hanya untuk Staff atau Project Manager." }, { status: 422 });
    }
    const current = await prisma.projectAssignment.findFirst({
      where: { organizationId, projectId, membershipId: target.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (current) return NextResponse.json({ error: "Anggota sudah memiliki assignment aktif." }, { status: 409 });
    const assignment = await prisma.projectAssignment.create({
      data: {
        organizationId, projectId, membershipId: target.id,
        assignmentRole: parsed.data.assignmentRole,
        assignedByMembershipId: actor.id,
        status: "ACTIVE",
      },
      select: { id: true, membershipId: true, assignmentRole: true, status: true, createdAt: true },
    });
    await prisma.auditLog.create({
      data: { organizationId, actorId: actor.userId, action: "PROJECT_ASSIGNMENT_CREATED", entityType: "ProjectAssignment", entityId: assignment.id, afterState: { projectId, membershipId: target.id, assignmentRole: assignment.assignmentRole } },
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ organizationId: string; projectId: string }> }) {
  try {
    const { organizationId, projectId } = await context.params;
    const actor = await requireTenantContext(organizationId);
    const access = await resolveProjectAccess(organizationId, projectId, actor);
    if (!access.project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Akses pengelolaan assignment tidak diizinkan." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Target assignment tidak valid." }, { status: 400 });
    const target = await prisma.projectAssignment.findFirst({
      where: { organizationId, projectId, membershipId: parsed.data.membershipId, status: "ACTIVE" },
      select: { id: true, assignmentRole: true },
    });
    if (!target) return NextResponse.json({ error: "Assignment aktif tidak ditemukan." }, { status: 404 });
    if (actor.role === "PROJECT_MANAGER" && target.assignmentRole === "PROJECT_MANAGER") {
      return NextResponse.json({ error: "Project Manager tidak dapat mencabut assignment Project Manager." }, { status: 403 });
    }
    const changed = await prisma.projectAssignment.updateMany({
      where: { id: target.id, organizationId, projectId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    if (changed.count !== 1) return NextResponse.json({ error: "Assignment berubah; muat ulang dan coba kembali." }, { status: 409 });
    await prisma.auditLog.create({
      data: { organizationId, actorId: actor.userId, action: "PROJECT_ASSIGNMENT_REVOKED", entityType: "ProjectAssignment", entityId: target.id, beforeState: { status: "ACTIVE" }, afterState: { status: "REVOKED" } },
    });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
