# Project & Document Access Control Policy

> Status: **Approved policy — implementation in progress; Preview validation required before merge.**
> Baseline: `fix/dms-security-hardening` at `73aa1e937a80fa86e455817cda78a0a842ec81ce`.
> Scope: Ops API authorization for project assignments and DMS resources. This document does not authorize Production changes.

## 1. Security principles

1. Deny by default. Organization membership is necessary but not sufficient for project-scoped resources.
2. Enforce every decision on the server. UI visibility is not an authorization boundary.
3. Resolve all resource relationships inside the active organization. Never trust client-supplied project, invoice, quotation, or client IDs.
4. A document linked to more than one business record must satisfy every applicable relationship and policy check.
5. Do not reveal whether a foreign-tenant or unauthorized project/document exists; use a consistent not-found response where appropriate.
6. Presigned URLs are bearer capabilities. Issue short-lived URLs only after authorization and integrity checks.
7. Keep an audit trail for sensitive changes and denied sensitive access without logging signed URLs, credentials, or document contents.

## 2. Proposed organization-role matrix

Legend: **Full** = organization-wide action; **Assigned** = only when the user has an active assignment to the linked project; **Scoped** = only the named business resource; **No** = denied by default.

| Role | Project read | Project write | Project documents | Finance/invoice documents | Organization-unlinked documents |
|---|---|---|---|---|---|
| OWNER | Full | Full | Full | Full | Full |
| ADMIN | Full | Full | Full | Full | Full |
| PROJECT_MANAGER | Assigned | Assigned (project operations) | Assigned read/upload/finalize | No by default; allow only explicitly designated project-finance scope | Own uploads only |
| FINANCE | Scoped to organization finance records | No project master-data edits | Read only when needed to support an authorized invoice/payment record | Scoped read/upload/finalize | Own uploads only |
| SALES | Scoped to assigned client/lead/quotation | No project master-data edits | Read only quotation/client-related documents | No | Own uploads only |
| STAFF | Assigned | No project master-data edits | Assigned read/upload; cannot finalize/delete by default | No | Own uploads only |
| CLIENT | No by default | No | No by default; future client portal policy required | No by default | No |

This is a conservative proposal, not an approved business policy. In particular, the business owner must decide whether Finance can access all organization invoices or only invoices assigned to a finance operator, whether Project Managers can access financial attachments, and whether Sales should retain access after a project is handed over.

## 3. Proposed project assignment model

Prefer an explicit assignment relation tied to an existing organization Membership, rather than storing an unvalidated user ID directly on Project.

Conceptual fields:

- `id`
- `organizationId`
- `projectId`
- `membershipId`
- `assignmentRole`: `PROJECT_MANAGER`, `CONTRIBUTOR`, or `VIEWER`
- `status`: `ACTIVE` or `REVOKED`
- `assignedByMembershipId` (nullable for migration/bootstrap policy only)
- `createdAt`, `updatedAt`, `revokedAt`

Required database invariants:

- Unique active assignment per `(organizationId, projectId, membershipId)` (implement with a partial unique index in SQL if Prisma cannot express it).
- Composite foreign keys enforce that project and membership belong to the same organization.
- Index lookup paths for `(organizationId, membershipId, status)` and `(organizationId, projectId, status)`.
- Revocation preserves historical assignment/audit data; do not hard-delete history.
- Validate that the membership role is compatible with the assignment role in the service layer.

## 4. Document resource classification

Resolve a document's effective scope from database relations, not request parameters:

1. **Project document**: `projectId` is set. Access requires the relevant project permission and active assignment, except OWNER/ADMIN.
2. **Invoice document**: `invoiceId` is set. Load invoice, quotation, project, and client relations within the same organization. Reject inconsistent client/project/quotation associations. Apply finance permission; if also project-linked, require both scopes unless the approved matrix explicitly defines a different precedence.
3. **Unlinked organization document**: neither `projectId` nor `invoiceId` is set. OWNER/ADMIN can access; uploader can access their own record only. No broad Staff/Client access by default.
4. **Invalid/legacy relation**: missing or inconsistent referenced record is quarantined from user access and reported for administrative repair. Never silently broaden access.

For a document linked to both project and invoice, the effective policy is the intersection of both scopes (deny if either check fails), unless a specifically approved Finance exception is implemented and tested.

## 5. API enforcement points

A shared policy service must be called by every DMS operation:

- List: filter database results by authorized document IDs/scopes before pagination; never fetch a broad page and filter it after pagination.
- Upload presign: authorize the target project/invoice and validate all relations before creating a pending record or signing a PUT.
- Finalize: re-load the pending document and re-evaluate current authorization and resource consistency before reading/finalizing the R2 object.
- Download presign: re-evaluate current authorization immediately before signing the GET URL and verify object integrity.
- Delete/quarantine/restore (if added): require explicit permission and audit the transition.
- A revoked assignment must stop new list, finalize, and download authorization immediately. Previously issued URLs remain usable only until their short expiry; keep expiry short.

Avoid a check-then-use gap where possible: bind database state transitions to organization, document status, and relation identifiers in conditional updates/transactions. Do not hold a database transaction open while streaming object bytes from R2.

## 6. Legacy data and rollout

- Do not auto-assign all existing project members or grant access to every organization member.
- Existing projects without assignments become accessible only to OWNER/ADMIN until assignments are explicitly created.
- Existing unlinked documents follow uploader/OWNER/ADMIN policy.
- Backfill must be reviewed, dry-run capable, idempotent, and auditable. No destructive data rewrite.
- Roll out in stages: schema + backfill report; policy helper in shadow/test mode; enforce read paths; enforce write/finalize/download paths; authenticated Preview E2E; then consider Production only after separate approval.
- Do not weaken existing tenant isolation or remove Preview SSO.

## 7. Required tests

- All seven roles against project assigned, unassigned, and revoked states.
- Cross-tenant membership/project/document/invoice IDs.
- Project-only, invoice-only, both-linked, and unlinked documents.
- Invoice/project/quotation/client relationship mismatch.
- Upload, finalize, list pagination, download presign, and concurrent assignment revocation.
- Uploader access after project assignment revocation and document ownership changes.
- Presigned URL expiry and no URL issuance on denied requests.
- No leakage of signed URLs, R2 object keys, checksums, or existence of foreign records in error responses.
- Integration tests against the test database plus unit tests for the shared policy service.

## 8. Approval questions

Before schema migration, the product owner must confirm:

1. Can Finance access all organization invoices, or only assigned projects/invoices?
2. Can Project Managers see invoice/payment attachments for their assigned projects?
3. Should Sales retain access to project/quotation documents after handover?
4. Can Staff upload project files but require a PM/Admin to finalize, or should uploaders be able to finalize their own files?
5. Should Client role be completely denied until a separately designed client portal exists?
6. Who can create/revoke project assignments: OWNER/ADMIN only, or also PROJECT_MANAGER within assigned projects?

Until these questions are approved, keep the policy in proposal state and do not create a production migration or alter live access.


## 8. Approved product-owner decisions

Approved by the product owner for this feature branch:

1. **Finance: all** — organization-wide invoice document read/upload/finalize/download, including invoice documents linked to projects.
2. **Project Manager: finance_read** — read/download invoice documents only when the invoice belongs to a project where the membership has an active PROJECT_MANAGER assignment. No invoice upload/finalize.
3. **Sales: retain** — read-only access to documents for explicitly assigned clients, including after project handover. No implicit access based only on organization membership.
4. **Staff: self** — may upload and finalize their own documents. Project documents require an active CONTRIBUTOR or VIEWER assignment; unlinked documents remain uploader-only.
5. **Client: portal** — read-only access only through an explicit active Client Portal grant to the linked client. No organization-wide access and no write actions.
6. **Assignment: owner_pm** — OWNER/ADMIN can manage project assignments; a PROJECT_MANAGER can manage contributor/viewer assignments only on projects where they hold an active PROJECT_MANAGER assignment. Only OWNER/ADMIN may assign/revoke another PROJECT_MANAGER.

Client and Sales grants are explicitly managed by OWNER/ADMIN and are audited. Revocation blocks new list/download/finalize requests; already-issued signed URLs remain usable only until their short expiry.

## 9. Implementation and rollout status

- Schema and migration are isolated to this feature branch.
- Existing projects and memberships are not auto-assigned.
- Production remains untouched. Do not run this migration against Production.
- Required next gates: Prisma schema validation, migration test database, TypeScript, unit/integration tests, and authenticated Preview end-to-end tests with SSO enabled.
- The branch is not merge-ready until all gates pass.
