import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@dzaroza/database";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

const appUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3001";

const trustedOrigins = [
  "http://localhost:3001",
  process.env.NEXTAUTH_URL,
  process.env.BETTER_AUTH_URL,
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  appName: "Dzaroza Property OS",
  baseURL: appUrl,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      requireEmailVerification: true,
      mapProfileToUser: (profile) => ({
        emailVerified: profile.email_verified === true,
      }),
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  user: {
    additionalFields: {
      isPlatformAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
    validateUserInfo: ({ source }) => {
      if (source.oauth?.providerId !== "google") return;
      const profile = source.oauth.profile;
      if (
        !profile ||
        typeof profile !== "object" ||
        !("email_verified" in profile) ||
        profile.email_verified !== true
      ) {
        return {
          error: "email_not_verified",
          errorDescription: "Akun Google harus memiliki email terverifikasi.",
        };
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            isPlatformAdmin: isPlatformAdminEmail(user.email),
          },
        }),
      },
      update: {
        before: async (userData) => {
          if (typeof userData.email !== "string") {
            return { data: userData };
          }
          return {
            data: {
              ...userData,
              isPlatformAdmin: isPlatformAdminEmail(userData.email),
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { id: true, email: true },
          });
          if (!user) return false;

          await prisma.user.update({
            where: { id: user.id },
            data: { isPlatformAdmin: isPlatformAdminEmail(user.email) },
          });
          return { data: session };
        },
      },
    },
  },
  telemetry: {
    enabled: false,
  },
});
