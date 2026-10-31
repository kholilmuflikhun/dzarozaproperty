import { prisma } from "@dzaroza/database";

export async function findTenantMembership(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { organizationId: true, userId: true, role: true },
  });
}
