import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateLimitEntry>();

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export function getClientAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
) {
  const client = getRedis();
  if (client) {
    const limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      prefix: "dzaroza:rate-limit",
    });
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      retryAfterSeconds: result.success
        ? 0
        : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }

  const now = Date.now();
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function cleanupRateLimitEntries() {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}