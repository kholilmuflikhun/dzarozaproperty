-- Add structured quotation line items and enforce same-tenant ownership.
CREATE UNIQUE INDEX "Quotation_organizationId_id_key" ON "Quotation"("organizationId", "id");

CREATE TABLE "QuotationItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotationItem_organizationId_quotationId_sortOrder_idx"
  ON "QuotationItem"("organizationId", "quotationId", "sortOrder");

ALTER TABLE "QuotationItem"
  ADD CONSTRAINT "QuotationItem_organizationId_quotationId_fkey"
  FOREIGN KEY ("organizationId", "quotationId")
  REFERENCES "Quotation"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
