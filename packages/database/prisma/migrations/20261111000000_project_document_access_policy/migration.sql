-- Project/document authorization foundations. No existing memberships or projects are auto-assigned.
CREATE TYPE "ProjectAssignmentRole" AS ENUM ('PROJECT_MANAGER', 'CONTRIBUTOR', 'VIEWER');
CREATE TYPE "ProjectAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_id_key" UNIQUE ("organizationId", "id");

ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_id_key" UNIQUE ("organizationId", "id");

CREATE TABLE "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "assignmentRole" "ProjectAssignmentRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "status" "ProjectAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedByMembershipId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClientPortalAccess" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "status" "ProjectAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectAssignment_organizationId_projectId_membershipId_status_idx" ON "ProjectAssignment"("organizationId","projectId","membershipId","status");
CREATE INDEX "ProjectAssignment_organizationId_membershipId_status_idx" ON "ProjectAssignment"("organizationId","membershipId","status");
CREATE INDEX "ProjectAssignment_organizationId_projectId_status_idx" ON "ProjectAssignment"("organizationId","projectId","status");
CREATE INDEX "ClientPortalAccess_organizationId_clientId_membershipId_status_idx" ON "ClientPortalAccess"("organizationId","clientId","membershipId","status");
CREATE UNIQUE INDEX "ClientPortalAccess_one_active_grant" ON "ClientPortalAccess"("organizationId","clientId","membershipId") WHERE "status" = 'ACTIVE';
CREATE INDEX "ClientPortalAccess_organizationId_membershipId_status_idx" ON "ClientPortalAccess"("organizationId","membershipId","status");
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_project_fkey" FOREIGN KEY ("organizationId","projectId") REFERENCES "Project"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_member_fkey" FOREIGN KEY ("organizationId","membershipId") REFERENCES "Membership"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_actor_fkey" FOREIGN KEY ("organizationId","assignedByMembershipId") REFERENCES "Membership"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_client_fkey" FOREIGN KEY ("organizationId","clientId") REFERENCES "Client"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_member_fkey" FOREIGN KEY ("organizationId","membershipId") REFERENCES "Membership"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only one active assignment may exist for a membership/project pair; revoked history is retained.
CREATE UNIQUE INDEX "ProjectAssignment_one_active_per_member_project" ON "ProjectAssignment"("organizationId","projectId","membershipId") WHERE "status" = 'ACTIVE';

CREATE TABLE "SalesClientAccess" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "status" "ProjectAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "SalesClientAccess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesClientAccess_organizationId_clientId_membershipId_status_idx" ON "SalesClientAccess"("organizationId","clientId","membershipId","status");
CREATE UNIQUE INDEX "SalesClientAccess_one_active_grant" ON "SalesClientAccess"("organizationId","clientId","membershipId") WHERE "status" = 'ACTIVE';
CREATE INDEX "SalesClientAccess_organizationId_membershipId_status_idx" ON "SalesClientAccess"("organizationId","membershipId","status");
ALTER TABLE "SalesClientAccess" ADD CONSTRAINT "SalesClientAccess_client_fkey" FOREIGN KEY ("organizationId","clientId") REFERENCES "Client"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesClientAccess" ADD CONSTRAINT "SalesClientAccess_member_fkey" FOREIGN KEY ("organizationId","membershipId") REFERENCES "Membership"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
