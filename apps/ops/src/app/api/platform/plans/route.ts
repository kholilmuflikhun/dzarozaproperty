import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma, Prisma } from "@dzaroza/database";
import { authOptions } from "@/lib/auth";

const planSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{2,40}$/),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  monthlyPrice: z.number().int().nonnegative(),
  yearlyPrice: z.number().int().nonnegative(),
  currency: z.literal("IDR").default("IDR"),
  maxUsers: z.number().int().positive().nullable().optional(),
  maxProjects: z.number().int().positive().nullable().optional(),
  maxStorageMb: z.number().int().positive().nullable().optional(),
  maxActivations: z.number().int().positive().max(100).default(1),
  featureFlags: z.record(z.string(), z.boolean()),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) return NextResponse.json({ error: "Akses platform admin diperlukan." }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Konfigurasi paket tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const plan = await prisma.plan.upsert({
    where: { code: input.code },
    create: {
      ...input,
      monthlyPrice: new Prisma.Decimal(input.monthlyPrice),
      yearlyPrice: new Prisma.Decimal(input.yearlyPrice),
      featureFlags: input.featureFlags,
    },
    update: {
      name: input.name,
      description: input.description,
      monthlyPrice: new Prisma.Decimal(input.monthlyPrice),
      yearlyPrice: new Prisma.Decimal(input.yearlyPrice),
      currency: input.currency,
      maxUsers: input.maxUsers,
      maxProjects: input.maxProjects,
      maxStorageMb: input.maxStorageMb,
      maxActivations: input.maxActivations,
      featureFlags: input.featureFlags,
    },
  });
  return NextResponse.json({ plan });
}
