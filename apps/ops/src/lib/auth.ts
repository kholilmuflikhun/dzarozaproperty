import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@dzaroza/database";

function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  })],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;
      const googleProfile = profile as { email_verified?: boolean } | undefined;
      if (googleProfile?.email_verified !== true) return false;
      const email = user.email.toLowerCase();
      const isPlatformAdmin = platformAdminEmails().includes(email);
      await prisma.user.upsert({
        where: { email },
        update: { name: user.name ?? undefined, isPlatformAdmin },
        create: { email, name: user.name ?? null, isPlatformAdmin },
      });
      return true;
    },
    async jwt({ token }) {
      if (typeof token.email === "string") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, isPlatformAdmin: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.isPlatformAdmin = dbUser.isPlatformAdmin;
        } else {
          token.sub = undefined;
          token.isPlatformAdmin = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.isPlatformAdmin = token.isPlatformAdmin === true;
      }
      return session;
    },
  },
};
