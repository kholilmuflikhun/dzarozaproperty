ALTER TABLE "Document"
  ADD COLUMN "parentDocumentId" TEXT;

CREATE UNIQUE INDEX "Document_organizationId_id_key"
  ON "Document"("organizationId", "id");

CREATE INDEX "Document_organizationId_parentDocumentId_version_idx"
  ON "Document"("organizationId", "parentDocumentId", "version");

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_organizationId_parentDocumentId_fkey"
  FOREIGN KEY ("organizationId", "parentDocumentId")
  REFERENCES "Document"("organizationId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
