-- Phase 2: secure quotation approval, project conversion and invoice line items.
ALTER TABLE "Quotation"
  ADD COLUMN "approvalTokenHash" TEXT,
  ADD COLUMN "approvalTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "approvalTokenUsedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Quotation_approvalTokenHash_key" ON "Quotation"("approvalTokenHash");

ALTER TABLE "Invoice"
  ADD COLUMN "quotationId" TEXT,
  ADD COLUMN "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tax" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE INDEX "Invoice_organizationId_quotationId_idx"
  ON "Invoice"("organizationId", "quotationId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_organizationId_quotationId_fkey"
  FOREIGN KEY ("organizationId", "quotationId")
  REFERENCES "Quotation"("organizationId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceItem_organizationId_invoiceId_sortOrder_idx"
  ON "InvoiceItem"("organizationId", "invoiceId", "sortOrder");

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_organizationId_invoiceId_fkey"
  FOREIGN KEY ("organizationId", "invoiceId")
  REFERENCES "Invoice"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
