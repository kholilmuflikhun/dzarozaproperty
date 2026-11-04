# Project Workspace & Automated Document Engine

This phase extends the existing Dzaroza Property OS monorepo. It does not create a parallel application.

## Project workflow

1. Create or select a client in the organization CRM.
2. Create a project from the organization project directory.
3. Complete the project workspace: business identity, client/site address, bank details, work items, payment terms and document settings.
4. Save the workspace. Work-item totals are recalculated on the server using Prisma Decimal. Payment terms must total exactly 100%.
5. Generate a preview for one of seven document types.
6. Manage change orders. Draft changes do not affect the contract; an approved change order updates the final contract calculation and recalculates only unpaid, un-invoiced payment terms.
7. Record weekly progress reports. The latest submitted report synchronizes the project progress percentage.
8. Create a draft invoice from an unpaid payment term. The payment term is linked to the invoice atomically and locked against destructive replacement.
9. Print or save the A4 document preview as PDF and copy a concise WhatsApp summary.

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
- GET /api/organizations/:organizationId/projects/:projectId/documents/:documentType
- POST /api/organizations/:organizationId/invoices with projectId and paymentTermId to create a draft invoice from a payment term

All endpoints reuse the existing tenant membership and role authorization helpers and scope database reads/writes by organization ID.

## Database additions

- ProjectWorkspace
- ProjectWorkItem
- PaymentTerm
- ChangeOrder and ChangeOrderItem
- ProgressReport
- ProjectDocumentType enum and document metadata/version columns on Document

Migration: 20261105000000_project_workspace_document_engine.

## Current implementation boundary

The seven document previews are rendered as HTML with A4 print styles. The browser's Print / Save PDF action produces the PDF locally. This phase does not yet archive generated PDF bytes into R2 or create a Document record for each generated revision. That requires a separate server-side PDF rendering and R2 persistence step, plus immutable document snapshots and download authorization.

The current invoice document view summarizes invoices attached to a project; the dedicated invoice module remains the source of truth for issue/send/payment actions. Legal document templates are operational starting points and should be reviewed before execution.
