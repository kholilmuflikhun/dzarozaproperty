-- A project document identity must have one active root revision.
-- This also prevents concurrent first-time generation/upload from creating sibling roots.
CREATE UNIQUE INDEX "Document_one_active_root_per_project_identity_key"
  ON "Document" ("organizationId", "projectId", "documentType", "documentNumber")
  WHERE "parentDocumentId" IS NULL
    AND "deletedAt" IS NULL
    AND "projectId" IS NOT NULL
    AND "documentType" IS NOT NULL
    AND "documentNumber" IS NOT NULL;
