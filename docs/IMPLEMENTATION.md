# Architecture, SaaS Model, Migration & Delivery Plan

## Monorepo
- `apps/marketing`: existing public website, moved without rewriting page content or re-encoding media.
- `apps/ops`: new Project & Business Operating System application.
- `apps/worker`: separate persistent job runner foundation.
- `packages/database`: Prisma/PostgreSQL schema and shared client.
- `packages/shared`: shared domain contracts.

Vercel should host marketing and ops as two projects from the same repository, with root directories `apps/marketing` and `apps/ops`. Keep the current production deployment/domain unchanged until a preview build and smoke test pass. Worker requires a persistent worker runtime, not a long-running process inside a serverless function.

## SaaS licensing and subscription
Dzaroza OS is a hosted multi-tenant SaaS first. Dzaroza itself is the first organization tenant and follows the same security rules as customers. Plans, monthly/yearly prices, feature flags, quotas, grace periods and trial policy are database-managed; no prices are assumed or hard-coded.

Commercial entities: Plan (catalog/limits), Subscription (tenant + plan + billing period), License (entitlement token), LicenseActivation (optional installation binding), BillingEvent (idempotent webhook receipt). User authentication and license entitlement are separate. Store only a one-way hash of license secrets and reveal plaintext once. Entitlements must be checked server-side on every protected operation. Platform operator controls are separate from tenant membership and all overrides are audited.

Payment: use a provider adapter. Midtrans is a candidate because the existing public site already uses it, but recurring capability and merchant settings must be verified. Until recurring billing is proven, monthly/yearly renewals use a new invoice and one-time checkout per period; do not pretend automatic card charging is configured. Verify webhook signature, amount, currency, order reference and provider status; persist provider event IDs uniquely and update subscription atomically. Failed renewal enters past-due/grace period; restrict paid features only after configured grace, never delete tenant data.

Future self-hosted licensing can add signed offline entitlements, activation caps and periodic online validation. Do not ship a self-hosted license scheme as if it were implemented in the cloud edition. Commercial launch also needs reviewed terms, privacy, cancellation/refund, data export/deletion and license grant documents.

## Public site migration
All existing source blobs were moved below `apps/marketing`; existing public routes and image assets remain in their app-relative paths. The original package manifest is adapted for workspace use. The old npm lockfile is retained in `docs/migration/legacy-package-lock.json` as migration evidence. Generate a fresh `pnpm-lock.yaml` by running `pnpm install`; never fabricate a lockfile. Update the Vercel marketing project's root directory and environment variables only after preview validation.

## Phase plan
0. Repository audit, migration, architecture and deployment mapping.
1. Foundation: database migrations, authentication, tenant resolution, RBAC, audit and settings.
2. CRM & sales: leads, clients, pipeline, follow-up, quotations and calculations.
3. Projects: lifecycle, WBS, tasks, milestones, progress, risks and issues.
4. Documents: seven automated documents, approvals, snapshots, revisions and PDF.
5. Finance: invoices, payment allocation/reversal, receivables, expenses, budget and margin.
6. Procurement & operations: vendor, PR, PO, receipt, vendor invoice/payment, field records.
7. BI, client portal and SaaS control plane: KPI, reports, plans, subscriptions, licenses, customer access.
8. QA/security/production: regression, tenant isolation, performance, backup/restore, monitoring, deployment and training.

A phase is complete only after implementation, migrations, real test execution, documentation and evidence. Current scaffold is not a claim that Phase 0–8 are finished.
