"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@dzaroza/database";

export async function getDashboardData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { user: session.user, memberships };
}
