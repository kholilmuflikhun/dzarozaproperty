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

Prisma schema includes User, Organization, Membership, Plan, Subscription, License, LicenseActivation, BillingEvent, AuditLog, Client, Lead, Project, Quotation, Invoice, PaymentTransaction and Expense. Subscription has a unique provider order reference; payment transactions can be tied to the subscription. Plans define monthly/yearly IDR prices, quotas, feature flags and activation limits.

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
- A tenant-scoped CRM Leads API is implemented at `/api/organizations/[organizationId]/leads`: authorized listing with bounded `limit` and stage filter; creation restricted to OWNER, ADMIN, PROJECT_MANAGER and SALES; optional same-tenant Client association; input validation; serializable transaction; and atomic audit logging.
- CI workflow uses read-only repository permissions, pnpm dependency caching and frozen-lockfile installation. It validates/applies the committed Prisma migration, checks tenant-scoped database constraints, runs type checks and unit tests, builds both apps and executes public-site/Ops smoke tests.
- CI-hardening changes are on draft PR #7 targeting `feat/monorepo-saas-foundation`; they have not been merged. Commit `56c6945` completed all quality gates successfully, including type checks, unit tests, production builds and both smoke tests. The subsequent CRM Leads API implementation is on a separate feature branch and awaits its own CI run.

**Not yet verified:** Google OAuth callback in preview; Midtrans sandbox callback; live HTTP-level cross-tenant E2E tests; PostgreSQL backup/restore; Vercel deployment and environment configuration for the current baseline. Do not merge to `main` or switch production until all required exit criteria pass.
