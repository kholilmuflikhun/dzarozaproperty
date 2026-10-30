import { prisma } from "@dzaroza/database";
export { createLicenseSecret, hashLicenseSecret, verifyLicenseSecret } from "@/lib/license-crypto";

type EntitlementSource = {
  status: string;
  currentPeriodEnd: Date | null;
  plan: {
    code: string;
    featureFlags: unknown;
    maxUsers: number | null;
    maxProjects: number | null;
    maxStorageMb: number | null;
  };
} | null;

export function computeEntitlements(subscription: EntitlementSource, now = new Date()) {
  const inPeriod = Boolean(subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now);
  const active = Boolean(subscription && ["ACTIVE", "TRIALING"].includes(subscription.status) && inPeriod);
  const rawFeatures = subscription?.plan.featureFlags;
  const features: Record<string, boolean> =
    active && rawFeatures && typeof rawFeatures === "object" && !Array.isArray(rawFeatures)
      ? rawFeatures as Record<string, boolean>
      : {};
  return {
    active,
    planCode: active ? subscription?.plan.code ?? null : null,
    status: subscription?.status ?? "NONE",
    validUntil: active ? subscription?.currentPeriodEnd?.toISOString() ?? null : null,
    features,
    limits: {
      users: active ? subscription?.plan.maxUsers ?? null : 0,
      projects: active ? subscription?.plan.maxProjects ?? null : 0,
      storageMb: active ? subscription?.plan.maxStorageMb ?? null : 0,
    },
  };
}
export async function getEntitlements(organizationId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return computeEntitlements(subscription);
}
export async function hasFeature(organizationId: string, feature: string) {
  const entitlements = await getEntitlements(organizationId);
  return entitlements.active && entitlements.features[feature] === true;
}
