import { NextResponse } from "next/server";
import { prisma } from "@dzaroza/database";

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    select: { code: true, name: true, description: true, monthlyPrice: true, yearlyPrice: true, currency: true, maxUsers: true, maxProjects: true, maxStorageMb: true, featureFlags: true },
    orderBy: { monthlyPrice: "asc" },
  });
  return NextResponse.json({ plans });
}
