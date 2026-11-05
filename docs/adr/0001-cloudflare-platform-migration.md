# ADR-0001: Migrate application hosting to Cloudflare while retaining Neon and Jagoan Hosting

- Status: Accepted for staged implementation; production cutover pending Preview validation and explicit release approval
- Date: 2026-11-05
- Decision owners: Dzaroza Property OS project owner

## Context

Dzaroza Property OS is a multi-tenant Next.js 16.4.3 monorepo using TypeScript, Prisma and Neon PostgreSQL. The current deployment pipeline is coupled to Vercel and has encountered build-rate-limit failures. The product owner requests Cloudflare Free as the application hosting and object-storage platform, while retaining Neon PostgreSQL and keeping the domain registered/managed at Jagoan Hosting.

This is an infrastructure-level change (Class C) and must be staged. The request authorizes planning and implementation of the migration, but does not authorize a production cutover, DNS/nameserver changes, data deletion, or disabling the current hosting path.

## Decision

1. Keep the existing monorepo, Next.js App Router, TypeScript, Prisma domain models, Neon PostgreSQL, tenant context, RBAC, APIs and UI contracts.
2. Target Cloudflare Workers for the Next.js application runtime. Evaluate vinext first because it is Cloudflare's current recommended Next.js path; it is beta, so compatibility checks and real Preview E2E are mandatory. Retain the existing Next.js/Vercel build path during the evaluation.
3. Use Cloudflare R2 private buckets for project documents, generated PDFs and attachments, partitioned by environment: dzaroza-ops-dev, dzaroza-ops-preview, dzaroza-ops-prod. Do not expose private project documents through public buckets.
4. Keep Neon PostgreSQL as the sole relational database. Do not migrate tenant, project, invoice, payment, license or subscription data into D1.
5. Keep Jagoan Hosting as domain registrar/account provider. DNS hosting may need to be delegated to Cloudflare for native Workers custom-domain routing; do not change nameservers or DNS records without a separate cutover checklist and explicit approval. Use a workers.dev Preview hostname first.
6. Keep SaaS licensing and subscription entitlements in the existing application/database domain. Cloudflare account resources are shared infrastructure, not customer tenant boundaries.

## Consequences

- Existing app routes, API contracts, domain models and user workflows must remain compatible.
- The app may require runtime-specific adjustments for Node.js APIs, Prisma client/driver, PDF generation, authentication callbacks, payment webhooks, image handling and packages with native binaries.
- R2 integration must retain short-lived authorized downloads, private access, content verification, immutable document revisions, tenant-scoped object keys and audit trails.
- Environment variables and secrets must be independently configured for dev, Preview and Production.
- Current Vercel deployment remains a rollback path until Cloudflare Preview and production readiness checks pass.
- Cloudflare Free limits and product availability must be checked against the actual account and expected workload before committing to a no-cost production claim.

## Required migration gates

1. Inventory all apps, routes, runtime APIs, packages, scheduled tasks, webhooks, storage paths and current deployment settings.
2. Run the vinext compatibility checker against the actual apps/ops app; review every unsupported or partially supported feature. If compatibility is insufficient, evaluate the documented OpenNext adapter as a fallback without changing the product architecture.
3. Add Cloudflare deployment scripts/configuration alongside existing scripts; do not remove Vercel configuration or CI until parity is proven.
4. Build and run locally in the Cloudflare Workers runtime. Validate auth/session, organization isolation, database queries, file uploads/downloads, PDF generation, Midtrans callbacks and all project/document flows.
5. Deploy a non-production Worker Preview on workers.dev; use isolated R2 dev/preview buckets and the existing Neon Preview database.
6. Run current-head CI, tenant-isolation negative tests, browser E2E, performance checks and UAT.
7. Prepare DNS/domain routing and rollback steps. Registrar stays at Jagoan; any DNS delegation is a separately approved operation.
8. Only after all gates pass may a separate explicit approval authorize production resource provisioning, secrets, domain routing and traffic cutover.

## Rollback

- Keep the current Vercel project and deployment path intact until post-cutover stabilization is complete.
- Do not change Neon schema or data ownership as part of hosting migration.
- Preserve existing R2 objects and document identities; do not bulk-delete or rename keys during the cutover.
- If Cloudflare runtime validation fails, route traffic through the existing Vercel deployment and fix the compatibility gap without changing application domain contracts.

## Approval boundary

The project owner has requested Cloudflare migration. This ADR approves the staged migration work and Preview validation. It does not approve Production deployment, DNS/nameserver changes, production secrets rotation, or removal of Vercel. Those remain explicit release decisions.


## Compatibility evidence update — 2026-11-05

The vinext compatibility workflow ran successfully (scan execution) on PR #18. Its reports are not a compatibility pass: Marketing scored 92% and Ops 93%, with NextAuth v4 flagged in both applications. Marketing also reports partial next/image support. See [Cloudflare scan results](../CLOUDFLARE-VINEXT-SCAN-RESULTS.md).

Cloudflare's current documentation positions vinext as the recommended path for new Next.js Workers applications and OpenNext as a maintenance path for existing OpenNext apps until vinext compatibility allows migration. Therefore OpenNext is only an experimental candidate for an isolated Preview validation here, not a replacement decision. The repository has not been migrated to either adapter.

Authentication inspection confirms different responsibilities in Marketing and Ops (Google JWT sessions/admin allowlist versus Google verified-email sign-in, Prisma user synchronization, platform-admin re-evaluation and custom login). No authentication provider rewrite is approved. The shared Prisma singleton also lacks a Workers-specific driver adapter; evaluate Prisma + Hyperdrive separately before runtime Preview.

 
## Current-head verification update — 2026-11-05
 
At PR #18 head `fc197273c30d080e615fee33b1a69a7e603dd182`, Monorepo quality gates run #460 completed successfully, including Preview migration-history reconciliation, Prisma validation/client generation, tenant constraints, TypeScript, unit tests, production builds and public/Ops smoke tests. Cloudflare compatibility scan run #4 also completed, but the scan findings remain open: NextAuth v4 is flagged in both apps and Marketing image optimization is partial. Vercel checks continue to report `build-rate-limit`, so a fresh Vercel Preview deployment is not verified.
 
The repository inventory shows no existing app-level Wrangler/OpenNext runtime configuration or Next.js middleware/proxy entrypoint. The current Cloudflare Worker remains a bootstrap scaffold, not an application deployment. Continue with an isolated Preview implementation only; do not interpret CI success as Workers runtime acceptance or Production release approval.
