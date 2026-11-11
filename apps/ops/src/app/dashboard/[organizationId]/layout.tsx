import { notFound, redirect } from "next/navigation";
import { prisma } from "@dzaroza/database";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireTenantContext } from "@/lib/tenant";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  let membership;
  try {
    membership = await requireTenantContext(organizationId);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: membership.organizationId },
    select: { id: true, name: true },
  });
  if (!organization) notFound();

  return (
    <DashboardShell
      organizationId={organization.id}
      organizationName={organization.name}
      role={membership.role}
    >
      {children}
    </DashboardShell>
  );
}
