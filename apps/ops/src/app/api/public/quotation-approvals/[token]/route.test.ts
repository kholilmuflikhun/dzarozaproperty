import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { prisma, consumePublicRateLimit } = vi.hoisted(() => ({
  prisma: { quotation: { findFirst: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn() },
  consumePublicRateLimit: vi.fn(),
}));
vi.mock("@dzaroza/database", () => ({ prisma, Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } }));
vi.mock("@/lib/public-rate-limit", () => ({ consumePublicRateLimit }));
import { GET, POST } from "./route";

const rawToken = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
const context = { params: Promise.resolve({ token: rawToken }) };
const request = (method: "GET" | "POST", body?: unknown) => new Request("https://example.test/api/public/quotation-approvals/token", {
  method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
}) as never;

describe("public quotation approval endpoint", () => {
  beforeEach(() => {
    prisma.quotation.findFirst.mockReset(); prisma.quotation.updateMany.mockReset(); prisma.$transaction.mockReset();
    consumePublicRateLimit.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });
  it("returns a no-store quotation snapshot for a valid bearer token", async () => {
    prisma.quotation.findFirst.mockResolvedValue({
      number: "QT-1", total: { toString: () => "1500000.00" }, issuedAt: new Date(), approvalTokenHash: tokenHash,
      client: { name: "Klien" }, items: [{ description: "Jasa", quantity: { toString: () => "1.000" }, unitPrice: { toString: () => "1500000.00" }, lineTotal: { toString: () => "1500000.00" } }],
    });
    const response = await GET(request("GET"), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(prisma.quotation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ approvalTokenHash: tokenHash, status: "SENT", approvalTokenUsedAt: null }) }));
  });
  it("rejects an expired or already consumed token", async () => {
    prisma.quotation.findFirst.mockResolvedValue(null);
    expect((await GET(request("GET"), context)).status).toBe(404);
  });
  it("rejects malformed decisions before opening a transaction", async () => {
    expect((await POST(request("POST", { decision: "MAYBE" }), context)).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("consumes a valid token once and writes the audit log atomically", async () => {
    const tx = {
      quotation: { findFirst: vi.fn().mockResolvedValue({ id: "q-1", organizationId: "org-1", number: "QT-1", total: "1500000", approvalTokenHash: tokenHash }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const response = await POST(request("POST", { decision: "ACCEPTED" }), context);
    expect(response.status).toBe(200);
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "SENT", approvalTokenHash: tokenHash, approvalTokenUsedAt: null }), data: expect.objectContaining({ status: "ACCEPTED", approvalTokenHash: null, approvalTokenUsedAt: expect.any(Date) }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "quotation.accepted", organizationId: "org-1" }) }));
  });
  it("returns 409 when another request already consumed the token", async () => {
    const tx = {
      quotation: { findFirst: vi.fn().mockResolvedValue({ id: "q-1", organizationId: "org-1", number: "QT-1", approvalTokenHash: tokenHash }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    expect((await POST(request("POST", { decision: "REJECTED" }), context)).status).toBe(409);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("blocks requests when the rate limit is exceeded", async () => {
    consumePublicRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });
    const response = await POST(request("POST", { decision: "ACCEPTED" }), context);
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("120");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
