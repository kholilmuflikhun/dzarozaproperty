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

function planAuditSnapshot(plan: {
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: { toString(): string };
  yearlyPrice: { toString(): string };
  currency: string;
  maxUsers: number | null;
  maxProjects: number | null;
  maxStorageMb: number | null;
  maxActivations: number;
  featureFlags: Prisma.InputJsonValue;
  isActive: boolean;
}) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice.toString(),
    yearlyPrice: plan.yearlyPrice.toString(),
    currency: plan.currency,
    maxUsers: plan.maxUsers,
    maxProjects: plan.maxProjects,
    maxStorageMb: plan.maxStorageMb,
    maxActivations: plan.maxActivations,
    featureFlags: plan.featureFlags,
    isActive: plan.isActive,
  } satisfies Prisma.InputJsonObject;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin || !session.user.id) {
    return NextResponse.json({ error: "Akses platform admin diperlukan." }, { status: 403 });
  }

  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Konfigurasi paket tidak valid.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  try {
    const plan = await prisma.$transaction(async (tx) => {
      // Read and write under the same serializable transaction so the audit
      // action and before-state describe the row this transaction actually saw.
      const existing = await tx.plan.findUnique({ where: { code: input.code } });
      const saved = await tx.plan.upsert({
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

      await tx.platformAuditLog.create({
        data: {
          actorId: session.user.id,
          action: existing ? "plan.updated" : "plan.created",
          entityType: "Plan",
          entityId: saved.id,
          beforeState: existing ? planAuditSnapshot({
            ...existing,
            featureFlags: existing.featureFlags as Prisma.InputJsonValue,
          }) : undefined,
          afterState: planAuditSnapshot({
            ...saved,
            featureFlags: saved.featureFlags as Prisma.InputJsonValue,
          }),
        },
      });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "Paket gagal disimpan. Silakan coba kembali." }, { status: 500 });
  }
}
