-- Phase 2 hardening: durable rate limits and invoice gateway checkout references.
ALTER TABLE "PaymentTransaction"
  ADD COLUMN "providerOrderId" TEXT,
  ADD COLUMN "checkoutToken" TEXT,
  ADD COLUMN "checkoutUrl" TEXT;

CREATE UNIQUE INDEX "PaymentTransaction_providerOrderId_key"
  ON "PaymentTransaction"("providerOrderId");

CREATE TABLE "PublicRateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PublicRateLimitBucket_resetAt_idx"
  ON "PublicRateLimitBucket"("resetAt");
