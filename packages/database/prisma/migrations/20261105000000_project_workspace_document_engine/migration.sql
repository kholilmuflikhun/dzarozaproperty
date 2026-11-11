CREATE TYPE "ProjectDocumentType" AS ENUM (
  'QUOTATION',
  'WORK_AGREEMENT',
  'PAYMENT_SCHEDULE',
  'CHANGE_ORDER',
  'PROGRESS_REPORT',
  'INVOICE',
  'HANDOVER'
);

CREATE TABLE "ProjectWorkspace" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "businessName" TEXT,
  "businessAddress" TEXT,
  "businessPhone" TEXT,
  "businessEmail" TEXT,
  "businessOwnerName" TEXT,
  "clientAddress" TEXT,
  "siteAddress" TEXT,
  "quotationDate" TIMESTAMP(3),
  "quotationValidDays" INTEGER NOT NULL DEFAULT 14,
  "spkSignedAt" TIMESTAMP(3),
  "durationDays" INTEGER,
  "documentSequence" INTEGER NOT NULL DEFAULT 1,
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "bankAccountName" TEXT,
  "maintenanceDays" INTEGER NOT NULL DEFAULT 30,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectWorkItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'WORK',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTerm" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNPAID',
  "dueAt" TIMESTAMP(3),
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTerm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeOrder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT,
  "notes" TEXT,
  "addedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deductedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "agreedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeOrderItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "changeOrderId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ChangeOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reportNumber" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "overallProgress" INTEGER NOT NULL,
  "completedItems" JSONB NOT NULL,
  "nextWeekPlans" JSONB NOT NULL,
  "blockers" TEXT,
  "clientDecision" TEXT,
  "paymentStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgressReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectWorkspace_organizationId_projectId_key" ON "ProjectWorkspace"("organizationId","projectId");
CREATE INDEX "ProjectWorkspace_organizationId_updatedAt_idx" ON "ProjectWorkspace"("organizationId","updatedAt");
CREATE INDEX "ProjectWorkItem_organizationId_projectId_sortOrder_idx" ON "ProjectWorkItem"("organizationId","projectId","sortOrder");
CREATE UNIQUE INDEX "PaymentTerm_organizationId_projectId_sequence_key" ON "PaymentTerm"("organizationId","projectId","sequence");
CREATE INDEX "PaymentTerm_organizationId_projectId_status_idx" ON "PaymentTerm"("organizationId","projectId","status");
CREATE UNIQUE INDEX "ChangeOrder_organizationId_number_key" ON "ChangeOrder"("organizationId","number");
CREATE UNIQUE INDEX "ChangeOrder_organizationId_id_key" ON "ChangeOrder"("organizationId","id");
CREATE INDEX "ChangeOrder_organizationId_projectId_createdAt_idx" ON "ChangeOrder"("organizationId","projectId","createdAt");
CREATE INDEX "ChangeOrderItem_organizationId_changeOrderId_sortOrder_idx" ON "ChangeOrderItem"("organizationId","changeOrderId","sortOrder");
CREATE UNIQUE INDEX "ProgressReport_organizationId_reportNumber_key" ON "ProgressReport"("organizationId","reportNumber");
CREATE INDEX "ProgressReport_organizationId_projectId_weekStart_idx" ON "ProgressReport"("organizationId","projectId","weekStart");

ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkItem" ADD CONSTRAINT "ProjectWorkItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkItem" ADD CONSTRAINT "ProjectWorkItem_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeOrderItem" ADD CONSTRAINT "ChangeOrderItem_organizationId_changeOrderId_fkey"
  FOREIGN KEY ("organizationId","changeOrderId") REFERENCES "ChangeOrder"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD COLUMN "documentType" "ProjectDocumentType",
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "metadata" JSONB;
