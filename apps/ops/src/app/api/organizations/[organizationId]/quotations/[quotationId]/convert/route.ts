import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, ProjectStatus, prisma } from "@dzaroza/database";
import { requireTenantRole, toHttpError } from "@/lib/tenant";

export async function POST(_request: NextRequest, context: { params: Promise<{ organizationId: string; quotationId: string }> }) {
  try {
    const { organizationId, quotationId } = await context.params;
    if (!organizationId || organizationId.length > 64 || !quotationId || quotationId.length > 64) {
      return NextResponse.json({ error: "ID organisasi atau quotation tidak valid." }, { status: 400 });
    }
    const actor = await requireTenantRole(organizationId, [
      MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROJECT_MANAGER, MembershipRole.SALES,
    ]);
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { organizationId, id: quotationId },
        include: { client: { select: { id: true, name: true } } },
      });
      if (!quotation) return { kind: "not-found" as const };
      if (quotation.status === "CONVERTED" && quotation.projectId) {
        const existing = await tx.project.findFirst({ where: { organizationId, id: quotation.projectId } });
        if (existing) return { kind: "already-converted" as const, project: existing };
      }
      if (quotation.status !== "ACCEPTED") return { kind: "not-accepted" as const };
      const subscription = await tx.subscription.findFirst({
        where: { organizationId, status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } },
        include: { plan: { select: { maxProjects: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (!subscription) return { kind: "subscription-required" as const };
      const projectCount = await tx.project.count({ where: { organizationId } });
      if (subscription.plan.maxProjects !== null && projectCount >= subscription.plan.maxProjects) {
        return { kind: "project-limit" as const, limit: subscription.plan.maxProjects, current: projectCount };
      }
      const claimed = await tx.quotation.updateMany({
        where: { organizationId, id: quotationId, status: "ACCEPTED", projectId: null },
        data: { status: "CONVERTED" },
      });
      if (claimed.count !== 1) return { kind: "conflict" as const };
      const project = await tx.project.create({
        data: {
          organizationId, clientId: quotation.clientId,
          code: `PR-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomUUID().slice(0,8).toUpperCase()}`,
          name: `Proyek ${quotation.number} — ${quotation.client.name}`,
          status: ProjectStatus.DRAFT,
          contractValue: quotation.total,
          progress: 0,
        },
      });
      await tx.quotation.update({
        where: { organizationId_id: { organizationId, id: quotationId } },
        data: { projectId: project.id },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "quotation.converted_to_project",
          entityType: "Quotation", entityId: quotationId,
          beforeState: { status: "ACCEPTED", projectId: quotation.projectId },
          afterState: { status: "CONVERTED", projectId: project.id, projectCode: project.code },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId, actorId: actor.userId, action: "project.created_from_quotation",
          entityType: "Project", entityId: project.id,
          afterState: { clientId: project.clientId, code: project.code, name: project.name, contractValue: project.contractValue.toString() },
        },
      });
      return { kind: "created" as const, project };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Quotation tidak ditemukan." }, { status: 404 });
    if (result.kind === "not-accepted") return NextResponse.json({ error: "Hanya quotation ACCEPTED yang dapat dikonversi." }, { status: 409 });
    if (result.kind === "subscription-required") return NextResponse.json({ error: "Langganan aktif diperlukan untuk membuat proyek." }, { status: 402 });
    if (result.kind === "project-limit") return NextResponse.json({ error: "Kuota proyek paket telah tercapai.", limit: result.limit, current: result.current }, { status: 409 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Quotation sudah dikonversi oleh proses lain." }, { status: 409 });
    return NextResponse.json({ project: result.project, alreadyConverted: result.kind === "already-converted" }, { status: result.kind === "created" ? 201 : 200 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Perubahan bersamaan terdeteksi. Silakan coba kembali." }, { status: 409 });
    }
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
