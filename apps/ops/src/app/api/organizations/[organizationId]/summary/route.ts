import { NextResponse } from "next/server";
import { prisma } from "@dzaroza/database";
import { requireTenantContext, toHttpError } from "@/lib/tenant";
import { ForbiddenError } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    if (!organizationId || organizationId.length > 64) throw new ForbiddenError();
    const membership = await requireTenantContext(organizationId);
    const [clients, leads, projects, openInvoices] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.lead.count({ where: { organizationId } }),
      prisma.project.count({ where: { organizationId } }),
      prisma.invoice.count({ where: { organizationId, status: { notIn: ["PAID", "VOID"] } } }),
    ]);
    return NextResponse.json({ organizationId: membership.organizationId, counts: { clients, leads, projects, openInvoices } });
  } catch (error) {
    const result = toHttpError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
