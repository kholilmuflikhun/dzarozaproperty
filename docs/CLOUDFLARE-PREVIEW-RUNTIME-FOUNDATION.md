# Cloudflare Preview Runtime Foundation

**Status:** isolated build foundation; not deployed.  
**Branch:** `feat/cloudflare-preview-runtime-foundation`  
**Base:** PR #18 documentation head `afc6b06b67564621da67747690d5e0cb8c5dc53a`.

## Objective

Prepare independent OpenNext build targets for the Marketing and Ops Next.js apps while preserving the existing Next.js/Vercel deployment path. This is a compatibility experiment, not a platform cutover.

## Added configuration

| App | Worker name | Wrangler config | OpenNext config |
|---|---|---|---|
| Marketing | `dzaroza-marketing-preview` | `apps/marketing/wrangler.jsonc` | `apps/marketing/open-next.config.ts` |
| Ops | `dzaroza-ops-preview-app` | `apps/ops/wrangler.jsonc` | `apps/ops/open-next.config.ts` |

Both Workers use `nodejs_compat`, the current repository compatibility date, separate worker names, Workers Static Assets output and observability. Ops declares the existing Preview R2 bucket through the `DOCUMENTS` binding. No production binding is configured.

## Build validation workflow

`.github/workflows/cloudflare-preview-runtime.yml` runs independently for both apps:
1. Install the existing monorepo lockfile unchanged.
2. Install exact OpenNext/Wrangler versions ephemerally in the CI runner only.
3. Run the OpenNext build.
4. Run Wrangler `deploy --dry-run` to validate the generated Worker bundle without deployment.
5. Upload short-lived diagnostics.

Pinned experiment versions: `@opennextjs/cloudflare@1.20.16` and `wrangler@4.157.0`. They are not added to application manifests or the committed lockfile yet. This deliberately avoids making an unverified runtime dependency part of the production dependency graph. Reassess and persist dependencies only after both builds pass.

## Explicit non-actions

- No Worker deployment, including Preview deployment.
- No secrets, OAuth callback URLs, database URLs or payment credentials were changed.
- No Prisma driver adapter or database package changes.
- No authentication implementation changes.
- No migration or database writes.
- No Vercel config/scripts removed or replaced.
- No DNS/nameserver, Production resource, PR #18 merge or live traffic change.

## Acceptance gates after CI

1. Both OpenNext builds and Wrangler dry-runs pass on the same commit.
2. Resolve build/runtime failures without changing application contracts.
3. Add Preview-only secrets and bindings only after confirming exact variable names and approved values.
4. Deploy each app to its dedicated workers.dev Preview only after explicit approval of the Preview deployment step.
5. Verify Google OAuth callback/session/logout/admin revocation and tenant isolation.
6. Verify Neon access through a Workers-compatible Prisma driver adapter, Midtrans Sandbox callbacks, PDF rendering, private R2 archive/revision/download, and image optimization.
7. Run browser E2E and UAT. Keep Vercel as rollback path.

A successful build or dry-run is not evidence of auth, database, storage, payment, tenant-isolation or end-to-end runtime compatibility.


## Runtime compatibility audit (2026-11-05)

### Authentication: high-risk / not yet runtime-validated

The existing apps have different NextAuth v4 responsibilities and must not be normalized into one shared callback implementation:

- Marketing uses Google OAuth with JWT sessions, copies the subject into `session.user.id`, and checks its `ADMIN_EMAILS` allowlist in the server-side admin-session helper.
- Ops requires a verified Google email, upserts the user in PostgreSQL during sign-in, refreshes the user ID from Prisma during JWT callbacks, and re-evaluates `PLATFORM_ADMIN_EMAILS` so admin revocation takes effect on refresh.

The OpenNext bundle build does not prove NextAuth v4 compatibility with the Workers runtime. Preserve these behaviors and add runtime tests for OAuth callback, cookie/session persistence, refresh, logout, verified-email rejection, and admin revocation before deciding whether an auth migration is needed. Do not mechanically replace NextAuth v4 or combine the two app configurations.

### Database: isolate the Workers client from the Node/Vercel client

The current `@dzaroza/database` entrypoint eagerly constructs a standard `PrismaClient` singleton. This is the existing Node/Vercel path and must remain unchanged for the current deployment.

For a Workers experiment, implement a separate, explicitly selected runtime entrypoint using Prisma's PostgreSQL driver adapter (`@prisma/adapter-pg`) with `pg` and a Hyperdrive connection string. Do not import `cloudflare:workers` from the shared Node entrypoint or expose Cloudflare-only runtime APIs to Vercel bundles. Resolve the Hyperdrive binding at the app/runtime boundary and inject the connection configuration into a Workers-specific database factory. Validate Prisma 6.19 compatibility, pool lifecycle, request concurrency and transaction behavior before connecting it to the Ops application.

### Image handling

The Marketing app currently declares remote image patterns for Google profile images and Vercel Blob. OpenNext build success alone does not establish that Next.js image optimization is equivalent on Workers. Verify optimized and unoptimized remote images in runtime Preview; if the image optimizer needs Cloudflare Images or a different loader, treat that as an explicit compatibility decision.

### Runtime acceptance matrix

| Area | Current assessment | Required evidence |
|---|---|---|
| NextAuth v4 | Unverified / high risk | Real Google OAuth Preview callback and session tests |
| Ops Prisma | Node-only client today | Workers adapter + Hyperdrive runtime tests |
| Tenant isolation | Existing DB constraints pass CI | Authenticated cross-tenant API E2E |
| R2 documents | Wrangler binding declared only | Upload, private download, revision and deletion tests |
| Midtrans | No Workers runtime proof | Sandbox create/notification/signature verification |
| Images | Remote patterns configured | Worker runtime image optimization tests |

These are implementation gates, not permission to deploy. Preview deployment remains approval-gated.
