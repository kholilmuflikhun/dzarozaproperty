# Cloudflare Migration — Ops First

## Decision

Migrate the Dzaroza Property OS Ops application to Cloudflare Workers first. Keep Vercel deployments, domains, project configuration, and production traffic unchanged until Cloudflare Preview passes the acceptance gates. Marketing is a separate subsequent migration.

### Target for this phase

- Runtime: Cloudflare Workers.
- Next.js adapter: evaluate Cloudflare-recommended `vinext` first; it is beta, so do not assume parity.
- Database: existing Neon PostgreSQL Preview, accessed through Cloudflare Hyperdrive.
- ORM: Prisma 6.19 baseline; validate Worker-compatible client generation and driver adapter requirements before changing dependencies.
- Object storage: existing private Cloudflare R2 bucket `dzaroza-ops-preview`.
- CI/CD: GitHub Actions with scoped Cloudflare API token, or Cloudflare Workers Builds after evaluating branch Preview support.
- Authentication: preserve NextAuth v4 + Google OAuth initially; validate cookies, callback URLs, JWT/session behavior, and production-safe secret separation.
- Payments: keep Midtrans Sandbox until webhook and callback verification pass on the Cloudflare Preview URL.

## Existing verified foundation

- Repository is a pnpm 10.18 monorepo with Turborepo.
- Ops app is Next.js 16.4.3, React 19.3.1, NextAuth 4.24.15.
- Database package uses Prisma 6.19.0 with PostgreSQL.
- Neon Preview contains seven successful migrations and is schema-up-to-date.
- Private R2 bucket `dzaroza-ops-preview` exists; R2 presign/finalize/list/download APIs are implemented on the current feature stack.
- Existing Preview R2 CORS must be extended only after the new Cloudflare Preview origin is known.
- Cloudflare account currently has no Worker scripts and no Hyperdrive configurations. This migration branch therefore starts without pre-existing Worker resources to overwrite.

## Non-negotiable safety boundaries

1. No Production database, Worker, R2 bucket, DNS, custom-domain, or traffic changes in the Preview migration.
2. Do not delete or disable Vercel projects or deployments.
3. Do not merge stacked PRs #12/#13 as part of this migration.
4. Do not expose or commit secrets. Store them as GitHub Actions secrets or Cloudflare Worker secrets.
5. Never run Prisma migrations against Production from a Worker deployment or build.
6. Keep Neon as the source of truth; do not convert PostgreSQL to D1.
7. Keep R2 buckets private; do not enable public `r2.dev` access.

## Phase gates

### CF-OPS-0 — Compatibility and deployment foundation
- Run `vinext check` against the Ops app and review every unsupported/partial API.
- Review NextAuth v4 OAuth route/cookie behavior, middleware/proxy use, server actions, route handlers, streaming, Node.js imports, and Prisma client runtime.
- Choose vinext only if critical auth/API/data flows pass. Otherwise evaluate OpenNext compatibility and document the tradeoff.
- Add Worker config, build scripts, generated binding types, observability, and isolated Preview deployment only after the compatibility report is reviewed.
- Produce a reproducible pnpm lockfile change using pnpm; never hand-edit the lockfile.

### CF-OPS-1 — Preview infrastructure
- Create a dedicated Hyperdrive configuration targeting Neon Preview only.
- Bind the existing private `dzaroza-ops-preview` R2 bucket.
- Add environment-specific Worker secrets for Preview only.
- Configure a stable Preview hostname and OAuth authorized redirect URI.
- Configure R2 CORS for the exact Preview origin.
- Enable Workers Logs and Traces.

### CF-OPS-2 — Runtime and security
- Validate Prisma adapter/client generation and transaction behavior via Hyperdrive.
- Preserve tenant membership and role enforcement; prove cross-tenant requests return 403 without querying or mutating tenant data.
- Verify Google OAuth login, callback, refresh, sign-out, and protected-route behavior.
- Verify DMS presign → upload → finalize → list → download against private R2.
- Verify Midtrans Sandbox notification signature, idempotency, and state transitions.
- Verify rate limits and any Upstash integration in Workers runtime.

### CF-OPS-3 — Preview acceptance
- CI: install frozen lockfile, Prisma validate/generate, migrations on disposable test DB, typecheck, unit tests, and build.
- E2E: authentication, workspace, tenant isolation, quotation, invoice, finance, DMS, and payment Sandbox.
- Performance: inspect request latency, database round trips, memory/CPU errors, and Worker logs.
- Security: inspect secrets, CORS, callback allowlists, upload limits, tenant isolation, and private object access.
- No production cutover until every critical gate is green.

### CF-OPS-4 — Production cutover (separate explicit approval)
- Create a separate Production Hyperdrive and Worker environment.
- Add Production secrets without copying Preview values.
- Configure production OAuth and payment provider URLs.
- Prepare DNS/custom domain and rollback plan.
- Shift traffic only after explicit approval; retain Vercel rollback until post-cutover verification completes.

### CF-MARKETING — later, separate project
- Migrate the Marketing app after Ops is stable.
- Replace `@vercel/blob` usage with Cloudflare R2, including an inventory and copy/verification plan for existing Blob objects.
- Revalidate Google Sheets, Upstash, Midtrans, analytics, rate limits, metadata, sitemap, robots, and public SEO routes.
- Keep public site and Ops deployments independently deployable.

## Environment mapping (Preview only)

| Existing variable/integration | Cloudflare destination |
|---|---|
| `DATABASE_URL` | Hyperdrive binding connection string; Prisma Worker adapter |
| `DIRECT_URL` | CI-only secret for Prisma migrations; never a runtime binding |
| `NEXTAUTH_URL` | Exact Cloudflare Preview origin |
| `NEXTAUTH_SECRET` | Preview Worker secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Preview Worker secrets |
| `PLATFORM_ADMIN_EMAILS` | Preview Worker secret or non-sensitive variable |
| `R2_*` | R2 binding for object operations; signing credentials only if the current S3 presign implementation requires them |
| `MIDTRANS_*` | Preview Worker secrets, Sandbox values only |

Do not copy Vercel environment variables wholesale. Bindings and secrets should follow least privilege and environment separation.

## Current blockers / unknowns

- No Cloudflare Worker scripts or Hyperdrive configurations currently exist in the account.
- No custom domain/DNS zone is configured in the connected Cloudflare account.
- Actual Worker compatibility of the existing NextAuth v4 + Prisma + Midtrans combination has not yet been demonstrated.
- The current environment has no local repository checkout/network access for running `vinext check` or generating a lockfile. Those checks must run in GitHub Actions or a connected coding environment before deployment.

## Official references

- Next.js on Workers / vinext: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Hyperdrive PostgreSQL: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
- Prisma + Hyperdrive: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/
- GitHub Actions deployment: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Workers observability: https://developers.cloudflare.com/workers/observability/
