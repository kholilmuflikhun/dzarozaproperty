import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@dzaroza/database";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

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
      const isPlatformAdmin = isPlatformAdminEmail(email);
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
          select: { id: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          // Re-evaluate the allowlist whenever NextAuth refreshes the JWT/session.
          // Removing an address from PLATFORM_ADMIN_EMAILS therefore revokes the
          // privilege without waiting for the user to sign out and back in.
          token.isPlatformAdmin = isPlatformAdminEmail(token.email);
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
