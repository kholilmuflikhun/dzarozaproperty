import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";

// Konfigurasi NextAuth — dipakai oleh route handler dan (jika perlu) getServerSession.
// Wajib isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan NEXTAUTH_SECRET di .env
// (lihat .env.example). Dapatkan kredensial Google OAuth dari:
// https://console.cloud.google.com/apis/credentials
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    // Memakai halaman default NextAuth; ubah jika ingin custom sign-in page.
  },
};

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  return isAdminEmail(session?.user?.email) ? session : null;
}
