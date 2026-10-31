export function membershipMatchesTenant(
  membership: { organizationId: string; userId: string } | null | undefined,
  organizationId: string,
  userId: string,
) {
  return Boolean(membership && membership.organizationId === organizationId && membership.userId === userId);
}

export function membershipHasAllowedRole<Role extends string>(
  membership: { role: Role } | null | undefined,
  allowedRoles: readonly Role[],
) {
  return Boolean(membership && allowedRoles.includes(membership.role));
}
