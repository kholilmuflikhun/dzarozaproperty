import { createHash } from "node:crypto";
import { Prisma, prisma } from "@dzaroza/database";

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export async function consumePublicRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`${scope}:${address}`).digest("hex");
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket" ("key", "count", "windowStartedAt", "resetAt")
    VALUES (${key}, 1, NOW(), NOW() + (${windowSeconds} * INTERVAL '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "PublicRateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "PublicRateLimitBucket"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "PublicRateLimitBucket"."resetAt" <= NOW() THEN NOW()
        ELSE "PublicRateLimitBucket"."windowStartedAt"
      END,
      "resetAt" = CASE
        WHEN "PublicRateLimitBucket"."resetAt" <= NOW() THEN NOW() + (${windowSeconds} * INTERVAL '1 second')
        ELSE "PublicRateLimitBucket"."resetAt"
      END
    RETURNING "count", "resetAt"
  `);
  const bucket = rows[0];
  if (!bucket) throw new Error("RATE_LIMIT_BUCKET_UNAVAILABLE");
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000));
  return { allowed: bucket.count <= limit, retryAfterSeconds: bucket.count <= limit ? 0 : retryAfterSeconds };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: "Terlalu banyak permintaan. Silakan coba kembali nanti." }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": String(retryAfterSeconds),
      "cache-control": "no-store",
    },
  });
}
