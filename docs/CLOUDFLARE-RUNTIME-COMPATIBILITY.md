# Cloudflare Runtime Compatibility Assessment

**Status:** assessment in progress; no application runtime migration has been performed.  
**Scope:** `apps/marketing`, `apps/ops`, shared database package, and existing Cloudflare Worker scaffold.  
**Baseline branch:** `feat/project-workspace-document-engine`.

## Decision

Keep Vercel as the active application host and rollback path. Treat Cloudflare Workers as a separate Preview target until compatibility scans, builds, and end-to-end acceptance pass independently for both Next.js applications.

Cloudflare currently recommends vinext for Next.js 16 on Workers. vinext is still in beta and its own project documentation warns that it is not a drop-in replacement for every production workload. Therefore, this project must use the compatibility report and runtime tests as gates, not infer compatibility from a successful Next.js build.

## Repository facts inspected

| Area | Current repository configuration | Compatibility concern to validate |
|---|---|---|
| Marketing | Next.js 16.4.3, React 19.3.1, NextAuth v4, Google APIs, Midtrans SDK, Vercel Blob | Node-oriented OAuth/Google APIs, payment SDK, Blob adapter, route handlers, image optimization and CSP |
| Ops | Next.js 16.4.3, React 19.3.1, NextAuth v4, Prisma client, Midtrans SDK | Auth/session behavior, Node APIs in server routes, Prisma connection and payment SDK |
| Database | Prisma 6.19, PostgreSQL, singleton `new PrismaClient()` | Worker runtime needs a supported driver adapter/connection strategy; do not assume the current Node singleton is Workers-safe |
| Existing Worker package | Node/tsx process entry point; queue provider is explicitly unconfigured | This package is not the Next.js runtime and must not be repurposed as the web app without a separate design |
| R2 | Existing private-document archive and Cloudflare R2 bucket binding provisioned for bootstrap Worker | Validate signed upload/download, metadata, SHA-256, tenant isolation and retention semantics in Workers Preview |

The current database package constructs Prisma directly with `new PrismaClient()`. Before a Workers deployment, evaluate the official Prisma adapter pattern for PostgreSQL through Cloudflare Hyperdrive (including `pg` and `@prisma/adapter-pg`) against the exact Prisma version in the lockfile. Any adapter change must be isolated behind the existing database package API and retain the Vercel/Node path.

## Non-destructive CI scan

Added `.github/workflows/cloudflare-compatibility.yml` to run `vinext check` independently in each app directory:

- `apps/marketing`
- `apps/ops`

The workflow uses Node 22 and pnpm 10.18.0, installs the frozen monorepo lockfile, and runs `pnpm dlx vinext check` from each app. It is triggered by manual dispatch or relevant pull-request changes.

**Important:** creating the workflow does not mean the scans have run. Record each scan's actual output and workflow conclusion here after GitHub Actions executes it. Do not mark compatibility as passed before that evidence exists.

## Required validation after compatibility scan

1. Resolve every critical/high issue from the vinext reports; document accepted gaps with owner and mitigation.
2. Run vinext development and production build independently for Marketing and Ops without replacing the existing `next` scripts.
3. Verify NextAuth sign-in, OAuth callback, session refresh, logout, CSRF and protected route behavior.
4. Verify Prisma migrations are not run by the Worker runtime; verify Preview-only Neon connectivity and transaction behavior through the selected adapter.
5. Verify Midtrans Sandbox create/notification/verification flow, signature validation and idempotency.
6. Verify Google APIs and token refresh in the deployed Worker runtime.
7. Verify PDF generation, R2 upload/finalization, SHA-256, revision chain, authorized download and cross-tenant denial.
8. Verify cron/queue/background behavior separately; the current Node/tsx worker foundation is not proof of a Workers queue implementation.
9. Run browser E2E at mobile/tablet/desktop widths and tenant-isolation negative tests.
10. Keep Vercel Preview as rollback until all gates pass and UAT is signed off.

## Prohibited until approval

- Do not run `vinext init` or replace existing Next.js scripts/configuration before reviewing both compatibility reports.
- Do not deploy the real application to the existing bootstrap Worker.
- Do not change live DNS, nameservers, Production environment variables, or Production database.
- Do not merge PR #18 or switch the domain to Cloudflare until Preview acceptance and explicit release approval.

## Official references

- Cloudflare Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- vinext project and compatibility caveats: https://github.com/cloudflare/vinext
- Cloudflare Prisma + Hyperdrive: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/


## Executed scan results — 2026-11-05

GitHub Actions Cloudflare Runtime Compatibility run #2 completed successfully on PR #18's merge ref. The scan itself reports findings:

| App | Overall | Libraries | Config | Notes |
|---|---:|---:|---:|---|
| Marketing | 92% | 2/3 | 1/2 | NextAuth v4 flagged; next/image partial (image resizing needs an optimizer) |
| Ops | 93% | 3/4 | 3/3 | NextAuth v4 flagged |

Both apps report NextAuth v4 as an issue because it relies on Next.js API route internals. Treat this as a blocker until auth parity is demonstrated in an isolated Workers Preview. The scan's green workflow conclusion means the checks completed, not that compatibility passed.

The detailed output and recommended controls are in [CLOUDFLARE-VINEXT-SCAN-RESULTS.md](./CLOUDFLARE-VINEXT-SCAN-RESULTS.md).

## OpenNext candidate assessment

OpenNext is not the default recommendation for a new Workers app; Cloudflare recommends vinext for new Next.js applications. OpenNext remains a documented path for maintaining an existing Next.js app when a vinext compatibility gap blocks migration. Evaluate it only as an isolated, additive Preview experiment. Do not change the production runtime or auth provider based on documentation claims alone.

Repository auth inspection found:

- Marketing: NextAuth v4 Google provider, JWT sessions, getServerSession, SessionProvider, and an admin-email allowlist.
- Ops: NextAuth v4 Google provider, JWT sessions (8-hour max age), sign-in callback requiring verified Google email, Prisma user upsert, JWT callback querying Prisma user and recalculating platform-admin privilege, custom /login page, and session fields for user ID/platform-admin.
- Both apps expose NextAuth route handlers at /api/auth/[...nextauth].

These flows have materially different authorization responsibilities. Any candidate runtime must prove callback, cookies, JWT/session, database access, admin revocation, tenant context and cross-tenant denial. No auth rewrite is approved.

## Prisma / Hyperdrive constraint

The shared database package currently instantiates PrismaClient without a driver adapter. Cloudflare's current Prisma + Hyperdrive guidance requires a driver adapter such as @prisma/adapter-pg with pg and the Hyperdrive connection string. Treat this as a separate compatibility workstream. The adapter must be introduced behind the existing @dzaroza/database public API, with an explicit runtime-specific construction strategy and regression tests for Vercel/Node. Do not mutate the existing singleton until this design and Preview credentials are ready.

## Current decision

- Vercel remains the active host and rollback path.
- vinext is not approved for migration while NextAuth is flagged.
- OpenNext may be tested in a separate Preview branch/configuration; it is not yet verified as compatible with this repository.
- No app dependencies, auth implementation, Prisma client construction, deployment target, secrets, DNS or Production resources were changed by this assessment.

 
## Current-head verification update — 2026-11-05
 
PR #18 head `fc197273c30d080e615fee33b1a69a7e603dd182` was rechecked after the compatibility assessment.
 
- Monorepo quality gates run #460 completed successfully: Preview migration-history reconciliation, Prisma schema/client generation, migration checks, tenant-scoped database constraints, TypeScript, unit tests, both production builds, public-site smoke test and Ops login smoke test all passed.
- Cloudflare Runtime Compatibility run #4 completed successfully. This is a successful scan execution only; the earlier compatibility findings (NextAuth v4 in both apps and partial Marketing image optimization) remain unresolved.
- Vercel status checks still report `build-rate-limit` for the public app, Ops Preview app and Blob default project. This is a Vercel infrastructure/quota block; it is not evidence that a new Vercel Preview deployment was produced.
- Repository tree inventory at this head found no app-level `middleware.ts`, `proxy.ts`, Wrangler config, OpenNext config or Cloudflare app runtime config. The only Cloudflare workflow is the compatibility scanner; the existing `apps/worker` remains a separate Node/tsx foundation.
 
The successful quality-gates run does not replace browser E2E/UAT or Workers runtime validation. The next safe implementation gate is a separate Cloudflare Preview build experiment with independent app configs and environment bindings; do not add adapter or Prisma dependencies until the exact build/runtime test can be executed and the auth gap has an explicit mitigation.
