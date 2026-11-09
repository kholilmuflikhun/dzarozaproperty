CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'QUARANTINED', 'DELETED');

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "invoiceId" TEXT,
  "uploadedById" TEXT,
  "fileName" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksumSha256" TEXT,
  "etag" TEXT,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_objectKey_key" ON "Document"("objectKey");
CREATE INDEX "Document_organizationId_status_createdAt_idx" ON "Document"("organizationId", "status", "createdAt");
CREATE INDEX "Document_organizationId_projectId_idx" ON "Document"("organizationId", "projectId");
CREATE INDEX "Document_organizationId_invoiceId_idx" ON "Document"("organizationId", "invoiceId");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_projectId_fkey"
  FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_invoiceId_fkey"
  FOREIGN KEY ("organizationId", "invoiceId") REFERENCES "Invoice"("organizationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
