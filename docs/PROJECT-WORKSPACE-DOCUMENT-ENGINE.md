# Project Workspace & Automated Document Engine

> **Continuity requirement:** This phase is an additive extension of the existing Dzaroza Property OS. All subsequent enhancements must follow [Engineering Governance](./ENGINEERING-GOVERNANCE.md): preserve established architecture, domain contracts, tenant authorization, navigation, design tokens and workflows. Do not replace or duplicate existing modules. Breaking changes require an approved ADR and migration/rollback plan.

This phase extends the existing Dzaroza Property OS monorepo. It does not create a parallel application.

## Project workflow

1. Create or select a client in the organization CRM.
2. Create a project from the organization project directory.
3. Complete the project workspace: business identity, client/site address, bank details, work items, payment terms and document settings.
4. Save the workspace. Work-item totals are recalculated on the server using Prisma Decimal. Payment terms must total exactly 100%.
5. Generate a preview for one of seven document types.
6. Generate a server-side PDF snapshot from the preview and archive it directly to private R2. The archive stores SHA-256, document number/type, version, and the immutable JSON data snapshot.
7. Manage change orders. Draft changes do not affect the contract; an approved change order updates the final contract calculation and recalculates only unpaid, un-invoiced payment terms.
8. Record weekly progress reports. The latest submitted report synchronizes the project progress percentage.
9. Create a draft invoice from an unpaid payment term. The payment term is linked to the invoice atomically and locked against destructive replacement.
10. Print or save the A4 document preview as PDF and copy a concise WhatsApp summary.

## Document types

- QUOTATION — Surat Penawaran Harga
- WORK_AGREEMENT — Surat Perjanjian Kerja (SPK)
- PAYMENT_SCHEDULE — Jadwal Termin Pembayaran
- CHANGE_ORDER — Berita Acara Kerja Tambah / Kurang
- PROGRESS_REPORT — Laporan Progres Pekerjaan
- INVOICE — Ringkasan invoice proyek
- HANDOVER — Berita Acara Serah Terima (BAST)

## Tenant-scoped endpoints

- GET/PUT /api/organizations/:organizationId/projects/:projectId/workspace
- GET/POST /api/organizations/:organizationId/projects/:projectId/change-orders
- PATCH /api/organizations/:organizationId/projects/:projectId/change-orders/:changeOrderId
- GET/POST /api/organizations/:organizationId/projects/:projectId/progress-reports
- GET/POST /api/organizations/:organizationId/projects/:projectId/documents/:documentType (POST renders and archives an immutable PDF snapshot)
- POST /api/organizations/:organizationId/invoices with projectId and paymentTermId to create a draft invoice from a payment term

All endpoints reuse the existing tenant membership and role authorization helpers and scope database reads/writes by organization ID.

## Database additions

- ProjectWorkspace
- ProjectWorkItem
- PaymentTerm
- ChangeOrder and ChangeOrderItem
- ProgressReport
- ProjectDocumentType enum and document metadata/version columns on Document
- Tenant-scoped immutable revision lineage on Document (`parentDocumentId`): each revision points to its immediate predecessor, carries an incremented version, and cannot branch from a superseded version.

Migrations:
- `20261105000000_project_workspace_document_engine`
- `20261106000000_document_revision_chains`

## Current implementation boundary

The seven document previews are rendered as HTML with A4 print styles. The browser's Print / Save PDF action remains available. The same preview data can now be rendered server-side into a PDF and archived directly to private R2 using the preview's POST action. The PDF renderer uses the repository's existing native PDF construction approach and does not require a headless browser.

Generated PDF snapshots and uploaded project files are archived in private R2. Generated snapshots include a SHA-256 checksum and a JSON copy of the exact data used to render the PDF. Each regeneration creates a new immutable revision in the same document chain.

Uploaded project files are archived in private R2. The archive supports revision chains: a new upload can select the latest stored document as its parent, keeps the project/type/document number consistent, increments the version, and preserves prior files. A composite database foreign key scopes each revision parent to the same organization. The API rejects revisions from superseded parents and cross-tenant parents. Revision metadata is currently based on uploaded files; generated HTML previews can now be explicitly frozen through the server-side PDF generation action.

The current invoice document view summarizes invoices attached to a project; the dedicated invoice module remains the source of truth for issue/send/payment actions. Legal document templates are operational starting points and should be reviewed before execution.

## Acceptance and future updates

This phase is not complete until the current PR-head CI, Preview deployment, tenant-isolation negative tests, real workflow E2E tests, document/PDF verification and UAT pass. A green workflow on an older commit is not sufficient.

Future updates must extend these workflows without changing their established behavior unexpectedly. New document types, fields, approval steps or rendering enhancements should be introduced additively, preserve historical snapshots/revisions, reuse the existing authorization and storage services, and include regression tests. See [Engineering Governance](./ENGINEERING-GOVERNANCE.md) for the required change classification and release gates.
