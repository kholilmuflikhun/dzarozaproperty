export type AccessRole = "OWNER" | "ADMIN" | "PROJECT_MANAGER" | "FINANCE" | "SALES" | "STAFF" | "CLIENT";
export type DocumentScope = "PROJECT" | "INVOICE" | "CLIENT" | "UNLINKED" | "INVALID";
export type DocumentAction = "READ" | "UPLOAD" | "FINALIZE" | "DOWNLOAD";
export type AssignmentState = "ACTIVE" | "REVOKED" | "NONE";

export interface DocumentAccessContext {
  role: AccessRole;
  userId: string;
  uploaderId?: string | null;
  scope: DocumentScope;
  projectAssignment?: AssignmentState;
  clientPortalAccess?: boolean;
  salesClientAccess?: boolean;
  projectLinkedToInvoice?: boolean;
}

export function canAccessDocument(context: DocumentAccessContext, action: DocumentAction): boolean {
  const { role, userId, uploaderId, scope } = context;
  if (scope === "INVALID") return false;
  if (role === "OWNER" || role === "ADMIN") return true;

  if (scope === "UNLINKED") {
    return (role === "STAFF" || role === "FINANCE" || role === "SALES" || role === "PROJECT_MANAGER")
      && uploaderId === userId
      && (action === "READ" || action === "UPLOAD" || action === "FINALIZE" || action === "DOWNLOAD");
  }

  if (role === "CLIENT") {
    return scope !== "UNLINKED"
      && context.clientPortalAccess === true
      && action === "READ";
  }

  if (scope === "INVOICE") {
    if (role === "FINANCE") return true;
    if (role === "PROJECT_MANAGER") {
      return context.projectLinkedToInvoice === true
        && context.projectAssignment === "ACTIVE"
        && (action === "READ" || action === "DOWNLOAD");
    }
    return false;
  }

  if (scope === "PROJECT") {
    if (role === "PROJECT_MANAGER") {
      return context.projectAssignment === "ACTIVE";
    }
    if (role === "STAFF") {
      return context.projectAssignment === "ACTIVE"
        && (action === "READ" || (uploaderId === userId && (action === "UPLOAD" || action === "FINALIZE" || action === "DOWNLOAD")));
    }
    return false;
  }

  if (scope === "CLIENT") {
    if (role === "SALES") return context.salesClientAccess === true && action === "READ";
    if (role === "CLIENT") return context.clientPortalAccess === true && action === "READ";
  }
  return false;
}

export function canManageProjectAssignments(role: AccessRole, isAssignedProjectManager = false) {
  return role === "OWNER" || role === "ADMIN" || (role === "PROJECT_MANAGER" && isAssignedProjectManager);
}
