import { beforeEach, describe, expect, it, vi } from "vitest";
const { prisma } = vi.hoisted(() => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("@dzaroza/database", () => ({ prisma, Prisma: { sql: (...parts: unknown[]) => parts } }));
import { consumePublicRateLimit } from "../public-rate-limit";

describe("PostgreSQL-backed public rate limiter", () => {
  beforeEach(() => prisma.$queryRaw.mockReset());
  it("allows requests inside the configured window", async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 2, resetAt: new Date(Date.now() + 60_000) }]);
    const result = await consumePublicRateLimit(new Request("https://example.test", { headers: { "x-real-ip": "192.0.2.1" } }), "approval", 8, 900);
    expect(result.allowed).toBe(true); expect(result.retryAfterSeconds).toBe(0);
  });
  it("rejects requests beyond the configured limit and returns retry timing", async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 9, resetAt: new Date(Date.now() + 45_000) }]);
    const result = await consumePublicRateLimit(new Request("https://example.test", { headers: { "x-real-ip": "192.0.2.2" } }), "approval", 8, 900);
    expect(result.allowed).toBe(false); expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("fails closed when the durable bucket cannot be written", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(consumePublicRateLimit(new Request("https://example.test"), "approval", 8, 900)).rejects.toThrow("RATE_LIMIT_BUCKET_UNAVAILABLE");
  });
});
