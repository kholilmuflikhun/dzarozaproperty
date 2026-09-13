import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Konfigurasi NextAuth — dipakai oleh route handler dan (jika perlu) getServerSession.
// Wajib isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan NEXTAUTH_SECRET di .env
// (lihat .env.example). Dapatkan kredensial Google OAuth dari:
// https://console.cloud.google.com/apis/credentials
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "240446496142-jdfo2s8o7jf82l6mgcba7hc1ehimooel.apps.googleusercontent.com",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "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",
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
