import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@dzaroza/database";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

/**
 * Resolve the current Better Auth session and refresh the platform-admin
 * allowlist claim on every server-side authorization read. Tenant membership
 * remains a separate authorization check.
 */
export async function getCurrentSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const isPlatformAdmin = isPlatformAdminEmail(session.user.email);
  if (session.user.isPlatformAdmin !== isPlatformAdmin) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { isPlatformAdmin },
    });
  }

  return {
    ...session,
    user: {
      ...session.user,
      isPlatformAdmin,
    },
  };
}
