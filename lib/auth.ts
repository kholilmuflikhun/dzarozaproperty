import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";

function requiredAuthConfig(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} belum dikonfigurasi.`);
  }
  return value;
}

export function getAuth() {
  const baseURL = requiredAuthConfig("BETTER_AUTH_URL");
  const secret = requiredAuthConfig("BETTER_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET harus memiliki minimal 32 karakter.");
  }

  return betterAuth({
    baseURL,
    secret,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(drizzle(env.AUTH_DB, { schema }), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    socialProviders: {
      google: {
        clientId: requiredAuthConfig("GOOGLE_CLIENT_ID"),
        clientSecret: requiredAuthConfig("GOOGLE_CLIENT_SECRET"),
      },
    },
    emailAndPassword: { enabled: false },
  });
}

export async function getAuthSession(requestHeaders: Headers) {
  return getAuth().api.getSession({ headers: requestHeaders });
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}

export async function getAdminSession(requestHeaders: Headers) {
  const session = await getAuthSession(requestHeaders);
  return isAdminEmail(session?.user?.email) ? session : null;
}
