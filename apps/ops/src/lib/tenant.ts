import { MembershipRole } from "@dzaroza/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { findTenantMembership } from "@/lib/tenant-data";
import { membershipMatchesTenant } from "@/lib/tenant-policy";
export { membershipMatchesTenant } from "@/lib/tenant-policy";

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}
export async function requireTenantContext(organizationId: string) {
  const userId = await requireUserId();
  const membership = await findTenantMembership(userId, organizationId);
  if (!membership || !membershipMatchesTenant(membership, organizationId, userId)) throw new ForbiddenError();
  return membership;
}
export async function requireTenantRole(organizationId: string, allowedRoles: MembershipRole[]) {
  const membership = await requireTenantContext(organizationId);
  if (!allowedRoles.includes(membership.role)) throw new ForbiddenError();
  return membership;
}
export function toHttpError(error: unknown) {
  if (error instanceof UnauthorizedError) return { status: 401, message: error.message };
  if (error instanceof ForbiddenError) return { status: 403, message: error.message };
  return { status: 500, message: "Terjadi kesalahan pada server." };
}
