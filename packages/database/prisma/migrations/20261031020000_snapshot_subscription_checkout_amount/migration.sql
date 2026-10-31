-- Preserve the exact price agreed when a subscription checkout is created.
-- Nullable for subscriptions created before this migration; webhook handling
-- falls back to the current plan price for those historical rows.
ALTER TABLE "Subscription" ADD COLUMN "checkoutAmount" DECIMAL(14,2);
