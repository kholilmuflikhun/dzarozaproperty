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
