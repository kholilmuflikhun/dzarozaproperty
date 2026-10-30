export function membershipMatchesTenant(
  membership: { organizationId: string; userId: string } | null | undefined,
  organizationId: string,
  userId: string,
) {
  return Boolean(membership && membership.organizationId === organizationId && membership.userId === userId);
}
