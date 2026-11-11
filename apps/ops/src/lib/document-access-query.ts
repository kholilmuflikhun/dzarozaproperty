import { prisma } from "@dzaroza/database";

type Actor = { id: string; userId: string; organizationId: string; role: string };

export function authorizedDocumentWhere(actor: Actor) {
  const tenant = { organizationId: actor.organizationId, status: "AVAILABLE" as const, deletedAt: null };
  if (actor.role === "OWNER" || actor.role === "ADMIN") return tenant;

  const scopes: Record<string, object[]> = {
    FINANCE: [{ invoiceId: { not: null } }],
    PROJECT_MANAGER: [
      { project: { assignments: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } },
      { invoice: { project: { assignments: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } },
    ],
    STAFF: [
      { projectId: { not: null }, invoiceId: null, project: { assignments: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } },
      { projectId: null, invoiceId: null, uploadedById: actor.userId },
    ],
    SALES: [
      { project: { client: { salesAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } },
      { invoice: { quotation: { client: { salesAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } } },
      { invoice: { project: { client: { salesAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } } },
    ],
    CLIENT: [
      { project: { client: { portalAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } },
      { invoice: { quotation: { client: { portalAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } } },
      { invoice: { project: { client: { portalAccesses: { some: { organizationId: actor.organizationId, membershipId: actor.id, status: "ACTIVE" } } } } } },
    ],
  };
  return { ...tenant, OR: scopes[actor.role] ?? [] };
}

export async function canManageDocument(
  actor: Actor,
  documentId: string,
  action: "READ" | "UPLOAD" | "FINALIZE" | "DOWNLOAD",
) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: actor.organizationId, deletedAt: null },
    select: {
      id: true, uploadedById: true, projectId: true, invoiceId: true,
      project: { select: {
        assignments: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } },
        client: { select: { salesAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } }, portalAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } } } },
      } },
      invoice: { select: {
        project: { select: {
          assignments: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } },
          client: { select: { salesAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } }, portalAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } } } },
        } },
        quotation: { select: { client: { select: { salesAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } }, portalAccesses: { where: { membershipId: actor.id, status: "ACTIVE" }, select: { id: true } } } } },
      } },
    },
  });
  if (!document) return false;
  if (actor.role === "OWNER" || actor.role === "ADMIN") return true;
  const salesGranted = (document.project?.client.salesAccesses.length ?? 0) > 0
    || (document.invoice?.project?.client.salesAccesses.length ?? 0) > 0
    || (document.invoice?.quotation?.client.salesAccesses.length ?? 0) > 0;
  const portalGranted = (document.project?.client.portalAccesses.length ?? 0) > 0
    || (document.invoice?.project?.client.portalAccesses.length ?? 0) > 0
    || (document.invoice?.quotation?.client.portalAccesses.length ?? 0) > 0;

  // Invoice scope takes precedence for linked invoice documents: Finance has
  // organization-wide invoice access; Project Managers are read-only.
  if (document.invoiceId) {
    if (actor.role === "FINANCE") return true;
    if (actor.role === "PROJECT_MANAGER") {
      return (document.invoice?.project?.assignments.length ?? 0) > 0
        && ["READ", "DOWNLOAD"].includes(action);
    }
    if (actor.role === "SALES") return salesGranted && action === "READ";
    if (actor.role === "CLIENT") return portalGranted && action === "READ";
    return false;
  }

  if (actor.role === "SALES") return salesGranted && action === "READ";
  if (actor.role === "CLIENT") return portalGranted && action === "READ";

  if (document.projectId) {
    const assigned = (document.project?.assignments.length ?? 0) > 0;
    if (actor.role === "PROJECT_MANAGER") return assigned;
    if (actor.role === "STAFF") {
      return assigned && (action === "READ" || (document.uploadedById === actor.userId && ["FINALIZE", "DOWNLOAD"].includes(action)));
    }
    return false;
  }
  return ["STAFF", "FINANCE", "SALES", "PROJECT_MANAGER"].includes(actor.role)
    && document.uploadedById === actor.userId
    && ["READ", "FINALIZE", "DOWNLOAD"].includes(action);
}
