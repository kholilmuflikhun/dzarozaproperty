-- A document revision chain must have at most one active child per parent.
-- This closes the race where concurrent uploads both pass the application-level
-- latest-parent check and create competing revisions.
CREATE UNIQUE INDEX "Document_one_active_child_per_parent_key"
  ON "Document" ("organizationId", "parentDocumentId")
  WHERE "parentDocumentId" IS NOT NULL AND "deletedAt" IS NULL;
