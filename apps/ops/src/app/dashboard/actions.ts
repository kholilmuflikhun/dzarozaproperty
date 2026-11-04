"use server";

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@dzaroza/database";

export async function getDashboardData() {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { user: session.user, memberships };
}
