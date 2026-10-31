import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { consumePublicRateLimit } from "@/lib/public-rate-limit";

export const runtime = "nodejs";
const decisionSchema = z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]) });

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function tokenMatches(stored: string, supplied: string) {
  const left = Buffer.from(stored, "hex");
  const right = Buffer.from(supplied, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rate = await consumePublicRateLimit(request, "quotation-approval-read", 30, 900);
  if (!rate.allowed) return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds), "cache-control": "no-store" } });
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ error: "Tautan persetujuan tidak valid." }, { status: 404 });
  const hash = hashToken(token);
  const quotation = await prisma.quotation.findFirst({
    where: { approvalTokenHash: hash, status: "SENT", approvalTokenUsedAt: null, approvalTokenExpiresAt: { gt: new Date() } },
    select: {
      number: true, total: true, issuedAt: true, approvalTokenHash: true,
      client: { select: { name: true } },
      items: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quotation || !quotation.approvalTokenHash || !tokenMatches(quotation.approvalTokenHash, hash)) {
    return NextResponse.json({ error: "Tautan tidak ditemukan, kedaluwarsa, atau sudah digunakan." }, { status: 404 });
  }
  return NextResponse.json({
    quotation: {
      number: quotation.number, clientName: quotation.client.name,
      total: quotation.total.toString(), issuedAt: quotation.issuedAt,
      items: quotation.items.map((item) => ({
        description: item.description, quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(),
      })),
    },
    allowedDecisions: ["ACCEPTED", "REJECTED"],
  }, { headers: { "cache-control": "no-store, private", "referrer-policy": "no-referrer" } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rate = await consumePublicRateLimit(request, "quotation-approval-decision", 8, 900);
  if (!rate.allowed) return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds), "cache-control": "no-store" } });
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return NextResponse.json({ error: "Tautan persetujuan tidak valid." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 }); }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Keputusan harus ACCEPTED atau REJECTED." }, { status: 400 });
  const tokenHash = hashToken(token);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { approvalTokenHash: tokenHash, status: "SENT", approvalTokenUsedAt: null, approvalTokenExpiresAt: { gt: new Date() } },
        select: { id: true, organizationId: true, number: true, total: true, approvalTokenHash: true },
      });
      if (!quotation || !quotation.approvalTokenHash || !tokenMatches(quotation.approvalTokenHash, tokenHash)) return null;
      const now = new Date();
      const changed = await tx.quotation.updateMany({
        where: {
          id: quotation.id, organizationId: quotation.organizationId, status: "SENT",
          approvalTokenHash: tokenHash, approvalTokenUsedAt: null, approvalTokenExpiresAt: { gt: now },
        },
        data: { status: parsed.data.decision, approvalTokenUsedAt: now, approvalTokenHash: null },
      });
      if (changed.count !== 1) return null;
      await tx.auditLog.create({
        data: {
          organizationId: quotation.organizationId, actorId: null,
          action: `quotation.${parsed.data.decision.toLowerCase()}`,
          entityType: "Quotation", entityId: quotation.id,
          beforeState: { status: "SENT" },
          afterState: { status: parsed.data.decision },
          metadata: { approvalMethod: "single_use_bearer_link" },
        },
      });
      return { number: quotation.number, decision: parsed.data.decision };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) return NextResponse.json({ error: "Tautan tidak valid, kedaluwarsa, atau sudah pernah digunakan." }, { status: 409 });
    return NextResponse.json({ message: "Keputusan berhasil dicatat.", quotation: result }, { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Keputusan sedang diproses. Periksa status quotation sebelum mencoba lagi." }, { status: 409 });
    }
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
