# Phase 0–1 Implementation Record

## Architecture and migration

- `apps/marketing`: existing public site source and app-relative public assets moved from repository root without rewriting page components or image binaries.
- `apps/ops`: Next.js App Router application for tenant-aware business operations.
- `apps/worker`: persistent worker entry point placeholder; queue adapter is not enabled.
- `packages/database`: Prisma/PostgreSQL schema, client and committed migrations.
- `packages/shared`: shared domain types.

The original marketing Next.js configuration, app routes, components, libraries, public assets, environment example and existing API routes were preserved under `apps/marketing`. Legacy npm lockfile is retained under `docs/migration/legacy-package-lock.json`. The workspace pnpm lockfile (`pnpm-lock.yaml`) and initial Prisma migration are committed to the repository; CI consumes the committed lockfile with frozen-lockfile mode and applies committed migrations. CI must not generate or auto-commit repository files.

## Phase 0 — exit criteria

1. Existing public website routes and assets are under `apps/marketing`.
2. Workspace dependency installation resolves reproducibly from the committed `pnpm-lock.yaml` using frozen-lockfile mode.
3. Marketing production build succeeds from its workspace root.
4. Preview smoke tests verify homepage, product detail, privacy, order API, testimonials, admin upload protection, sitemap and robots.
5. Existing Midtrans, Google Sheets, Redis, Blob and OAuth environment variables are configured in the marketing Vercel project.
6. Vercel preview is healthy before production domain/DNS changes.

Source relocation and repository workspace files are committed. CI validates the repository build and smoke-test surface, but Vercel environment configuration and a healthy deployed preview have not been independently verified. Do not mark Phase 0 complete based on file relocation or CI alone.

## Phase 1 — database and identity

### Database model

Prisma schema includes User, Organization, Membership, Plan, Subscription, License, LicenseActivation, BillingEvent, AuditLog, Client, Lead, Project, Quotation, QuotationItem, Invoice, PaymentTransaction and Expense. Subscription has a unique provider order reference; payment transactions can be tied to the subscription. Plans define monthly/yearly IDR prices, quotas, feature flags and activation limits.

### Authentication

Ops uses NextAuth Google OAuth with JWT sessions. Google email must be verified. A successful sign-in upserts a local User record; the session contains the database user ID and platform-admin flag. The `PLATFORM_ADMIN_EMAILS` environment allowlist can bootstrap platform operators. Set strong `NEXTAUTH_SECRET` and exact OAuth callback URL in each environment.

### Tenant isolation and RBAC

- Membership is the only source of organization access.
- `requireTenantContext` resolves the authenticated database user and requires the composite `organizationId_userId` membership.
- `requireTenantRole` applies role authorization for owner/admin operations.
- Organization creation, membership owner assignment and audit record are one database transaction.
- Organization summary queries are scoped by the authorized organization ID.
- Unit tests cover tenant policy and mocked endpoint authorization behavior.
- PostgreSQL-backed route-handler integration tests cover Projects and Clients read isolation, Members authorization denial, and CRM Leads read/write tenant boundaries (including rejection of a Client ID owned by another organization). The Leads API also has unit coverage for filtering, validation, role authorization, atomic audit logging and pagination limits.
- These tests invoke Next.js route handlers directly with a real PostgreSQL database and mock only the NextAuth session boundary. They are not live-server HTTP transport E2E tests.
- Future business repositories must accept a verified tenant context and include organization scope in every read/write; do not accept raw organization IDs as authorization.

### Subscription and payment

A tenant owner/admin can create a pending monthly or yearly subscription for an active database plan. The server creates a unique Midtrans order and Snap checkout using the configured merchant credentials. If credentials are absent, checkout returns 503 and does not create a subscription.

Webhook processing verifies the Midtrans SHA-512 signature with constant-time comparison, resolves the exact provider order, verifies amount/currency, stores a unique billing event, and atomically records payment and activates the subscription. Only settlement or accepted capture is successful. Duplicate provider events are idempotent. This is a one-time checkout per billing period; automatic recurring charge is not claimed.

### License and entitlements

License secrets use cryptographically secure random bytes. Only SHA-256 hashes are stored; plaintext is returned once with checkout creation. Subscription entitlement is separately checked from identity and requires ACTIVE/TRIALING status plus a future paid-through date. Plan feature flags and limits are returned from a server-side entitlement resolver. Hosted SaaS does not use a license key as a login credential.

### Phase 1 — exit criteria

1. Initial Prisma migration is committed and deploys against an empty PostgreSQL database.
2. Prisma client generation and schema validation pass.
3. Google OAuth login, verified email handling, session persistence and logout pass in a configured preview.
4. Organization create/list and owner membership work.
5. PostgreSQL-backed route-handler tests cover Projects, Clients and Members tenant access boundaries; live HTTP E2E remains outstanding.
6. Owner/admin-only subscription creation is enforced.
7. Midtrans invalid signature, wrong amount, unknown order, pending, settlement, accepted capture and duplicate webhook cases are tested.
8. License plaintext is never persisted or logged; only its hash is stored.
9. Subscription entitlement expiry and disabled feature behavior are tested.
10. CI typecheck, unit tests and both production builds pass.

## Current implementation state

- Repository migration branch exists and original marketing files are relocated.
- Ops login, organization dashboard, membership checks, organization APIs and summary endpoint have been added.
- Subscription checkout, Midtrans webhook verification, plan management endpoint, license secret primitives and entitlement resolver have been added.
- Unit tests cover tenant matching, license hashing/verification and Midtrans signature/status logic.
- PostgreSQL-backed route-handler integration tests cover tenant isolation for Projects, Clients and CRM Leads, plus authorization denial for Members. Leads tests additionally cover successful creation with an audit record and rejection of a cross-tenant Client reference. The tests use the real Prisma/PostgreSQL database and mock the NextAuth session boundary; they do not exercise a running HTTP server.
- A tenant-scoped CRM Leads API is implemented at `/api/organizations/[organizationId]/leads`: authorized listing with bounded `limit`, stage filter and cursor pagination; creation restricted to OWNER, ADMIN, PROJECT_MANAGER and SALES; optional same-tenant Client association; input validation; serializable transaction; and atomic audit logging.
- A tenant-scoped Quotation API is implemented at `/api/organizations/[organizationId]/quotations`: authorized listing with status filter and cursor pagination; creation restricted to OWNER, ADMIN, PROJECT_MANAGER and SALES; server-calculated line totals, subtotal, discount, tax and grand total; optional same-tenant Project association validated against the selected Client; structured QuotationItem rows; serializable transaction; and atomic audit logging.
- Quotation detail API at `/api/organizations/[organizationId]/quotations/[quotationId]` supports tenant-scoped retrieval, editing only while status is `DRAFT`, and sending a draft to `SENT`. Editing replaces line items and recalculates all amounts server-side; send/edit writes audit records atomically. Sent quotations are locked against further edits. Client acceptance/rejection and conversion to projects are not yet implemented. A composite tenant foreign key protects QuotationItem ownership at the database layer.
- CI workflow uses read-only repository permissions, pnpm dependency caching and frozen-lockfile installation. It validates/applies the committed Prisma migration, checks tenant-scoped database constraints, runs type checks and unit tests, builds both apps and executes public-site/Ops smoke tests.
- CI-hardening changes are on draft PR #7 targeting `feat/monorepo-saas-foundation`; they have not been merged. Commit `56c6945` completed all quality gates successfully, including type checks, unit tests, production builds and both smoke tests. CRM Leads API is on draft PR #8 and its latest quality-gate run was still in progress at the last check. Quotation Management is being developed on a separate feature branch with its own CI trigger.

**Not yet verified:** Google OAuth callback in preview; Midtrans sandbox callback; live HTTP-level cross-tenant E2E tests; PostgreSQL backup/restore; Vercel deployment and environment configuration for the current baseline. Do not merge to `main` or switch production until all required exit criteria pass.


## Phase 2 — business and finance workflows

### Quotation approval and project conversion

- Internal users can generate a single-use client approval link for a quotation in `SENT` state. The raw bearer token is generated with cryptographic randomness, only its SHA-256 hash is persisted, and the link expires after seven days. Creating a new link rotates and invalidates the prior token. Delivery is manual; email/SMS sending is not claimed.
- The public approval endpoint exposes the quotation snapshot to the bearer-link holder and accepts one decision (`ACCEPTED` or `REJECTED`). The token is consumed atomically, expiry and status are checked at write time, and the action is audit logged. The link is a bearer credential: anyone possessing it can decide on behalf of the recipient, so it must be sent only to the verified client contact.
- Only an accepted quotation can be converted. Conversion creates a tenant-scoped project, carries over the accepted contract total and client, enforces the active subscription project quota, and writes audit events. Repeated requests return the already-created project rather than creating duplicates.

### Invoice management

- Tenant-scoped invoice listing and creation support manually itemized invoices or invoice creation from an accepted/converted quotation. Amounts are recalculated from item quantity and unit price on the server. One invoice per quotation is enforced by a composite unique constraint.
- Invoice detail supports issue (`DRAFT` → `SENT`) and void actions. Invoices with any recorded payment cannot be voided. Invoice line items are stored separately with composite tenant ownership constraints.
- This phase does not yet implement PDF rendering, invoice email delivery, tax jurisdiction rules, credit notes, or automatic recurring invoices.

### Payment tracking

- Finance/owner/admin users can record a manually verified payment against an issued invoice. The transaction, invoice paid balance/status update and audit entries are committed atomically. Partial payments are supported; overpayments, payments against drafts/void/paid invoices and cross-tenant invoice references are rejected.
- Manual entries are explicitly marked `MANUAL` / `SETTLEMENT`. This is an operator-confirmed accounting entry, not a bank reconciliation or gateway webhook. Refunds, payment allocation across multiple invoices and automated Midtrans invoice collection are not included.

### Financial dashboard

- Tenant-scoped summary endpoint and organization finance dashboard UI report current-month invoiced value, settled invoice collections, expenses, net cash flow, outstanding receivables and a six-month collection/expense trend. The workspace links to `/dashboard/[organizationId]/finance`.
- Operational income is based on settled invoice payments, not merely issued invoice value. Subscription payments are excluded from tenant operating revenue. Expenses use their recorded `incurredAt` date.

### Phase 2 — remaining validation and exit criteria

1. Prisma migration applies cleanly to a fresh PostgreSQL database and Prisma Client generation succeeds.
2. Unit and PostgreSQL-backed route-handler integration tests cover approval token expiry/replay, tenant boundaries, accepted-quotation conversion idempotency, invoice totals/uniqueness, partial/full payments, overpayment rejection and financial aggregates.
3. TypeScript, unit tests, production builds and smoke tests pass in CI.
4. Security review verifies token-link delivery and disclosure, rate limiting/abuse protection, audit retention and operational role policy.
5. Preview verification is completed for real client approval flows, invoice delivery and finance reconciliation.
6. PDF invoice output, email delivery, tax configuration, refunds, payment gateway collection and bank reconciliation remain separate follow-up scope.

**Phase 2 status:** implementation has been opened on the feature branch and is awaiting CI plus the test/security hardening above. It is not production-ready until all exit criteria pass.


### Phase 2 hardening additions

- **Durable public rate limiting:** approval-link reads are limited to 30 requests per 15 minutes per client address; decisions are limited to 8 per 15 minutes. Buckets are atomically incremented in PostgreSQL, so limits are shared across app instances. The reverse proxy must overwrite trusted client-IP headers; do not trust arbitrary client-supplied forwarding headers on a directly exposed origin.
- **Approval email delivery:** when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured, approval links are sent through Resend to the client's stored email address. If email is not configured or the client has no email, the API explicitly returns a one-time manual link. Failed email delivery invalidates the generated token and writes an audit event. The approval URL is not written to logs.
- **Invoice PDF:** `GET /api/organizations/[organizationId]/invoices/[invoiceId]/pdf` returns a tenant-protected PDF attachment with line items, totals, paid amount and balance.
- **Invoice email:** `POST /api/organizations/[organizationId]/invoices/[invoiceId]/send` sends the PDF attachment to the verified client contact through Resend and records success/failure in AuditLog.
- **Invoice online payment:** `POST /api/organizations/[organizationId]/invoices/[invoiceId]/checkout` creates or reuses a pending Midtrans Snap checkout for the remaining invoice balance. Abandoned checkout sessions older than 30 minutes are no longer reused.
- **Midtrans invoice webhook:** signed Midtrans notifications are matched to the invoice payment order, amount-checked, deduplicated through BillingEvent, and applied atomically to the payment transaction and invoice paid balance. Replays do not double-apply settlement.
- **Payment configuration:** configure `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_IS_PRODUCTION` for checkout/webhook use. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for automatic approval and invoice email. Without Resend, approval links remain explicitly manual and invoice email returns 503.
- **PDF limitation:** invoice PDF uses a built-in Helvetica renderer without external PDF runtime dependencies. It supports multi-page line items; non-ASCII glyphs outside the basic Latin range are substituted. If full Unicode typography or a branded template is required, use a font-embedded renderer in a later UI/document-design pass.

### Phase 2 verification coverage

- Unit tests cover approval token validation/replay/rate-limit behavior, durable rate-limit decisions, email provider success/failure, PDF structure/multi-page output and Midtrans checkout creation/reuse.
- PostgreSQL-backed integration tests cover real approval token issuance/expiry/replay, accepted quotation conversion idempotency, invoice creation/issue, partial/full/manual payment, overpayment rejection, PDF download, financial summary aggregates and Midtrans invoice settlement/replay.
- CI remains the authority for the final result. A successful run on an older commit does not certify later changes; review the run matching the current PR head SHA.


### Phase 2 operational UI

- Client approval link now opens the no-index client decision page at `/approval/[token]`, which loads the quotation snapshot and provides explicit accept/reject actions. It uses the same one-time token API and does not require a client account.
- Organization workspace now links to the quotation manager, invoice manager and finance dashboard.
- Quotation manager supports manual quotation creation, issuing, sending/rotating approval links, copying manual links, accepted quotation conversion and invoice creation.
- Invoice manager supports manual invoice creation, issuing, PDF download, email delivery, Midtrans checkout and manual payment recording. Role enforcement remains on the API; UI visibility is not treated as authorization.
- These UI pages are part of the same Phase 2 feature branch and must pass the full CI suite before the phase is considered ready for review.
