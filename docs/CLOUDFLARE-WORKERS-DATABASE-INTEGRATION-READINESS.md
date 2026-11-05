# Cloudflare Workers Database Integration Readiness Audit

Date: 2026-11-05
Branch: `feat/cloudflare-preview-runtime-foundation`
Pull request: #19

## CI update — commit `7352cb9ecf6d2a5e47cb1892de246bbe846ba486`

The latest PR checks are green: both OpenNext Preview builds, Vinext compatibility scan, and the `validate` workflow (Prisma schema/client, Preview migration and tenant constraints, TypeScript, unit tests, production builds, and smoke tests). The Workers Prisma lifecycle test now checks the Prisma client construction contract without relying on undocumented adapter internals. This is CI/build validation only; it does not prove a live workerd-to-Neon request.

## Latest CI verification

Commit `b5460e696427886ca7d77c0e8679529ab867bcac` passed all three workflow runs:

- Cloudflare Runtime Compatibility: success.
- Cloudflare Preview Runtime Build: success for both Marketing and Ops, including OpenNext builds and Wrangler dry-run bundle validation.
- Monorepo quality gates: success for locked workspace installation, ephemeral pinned OpenNext and Neon adapter installation, Prisma schema validation and client generation, local PostgreSQL migrations, tenant-scoped database constraints, TypeScript, unit tests, production builds, and public-site/Ops-login smoke tests.

These checks validate builds and the Node/Vercel path. They do not validate a live Cloudflare Worker request, Neon connectivity from workerd, or tenant isolation in that runtime.

## Decision

Keep the Cloudflare runtime work isolated and additive. Do not route existing Ops handlers to the Workers Prisma client until the adapter is a permanent, lockfile-backed runtime dependency and an actual workerd request has passed database and tenant-isolation tests.

The current Vercel/Node database path remains the production and rollback path.

## Verified repository facts

- `packages/database/src/index.ts` exports the existing module-level `@prisma/client` singleton. Existing Ops handlers import `prisma` from `@dzaroza/database`.
- `packages/database/src/workers.ts` is a separate request-scoped factory using the generated `workerd` client and `PrismaNeon`. It is not exported from the package root and is not wired into Ops handlers.
- `@prisma/adapter-neon` is not declared in `packages/database/package.json`; the Cloudflare workflows currently install it ephemerally for CI validation. Do not make this factory a runtime dependency until the package manifest and pnpm lockfile are updated together using pnpm.
- The Ops documents API and project workspace API still use the established `prisma` singleton. The documents API explicitly declares `runtime = "nodejs"`; the project workspace route uses the default Next.js runtime.
- The organization summary API is a candidate low-risk read-only pilot: it authenticates through `requireTenantContext` and scopes all four count queries to the supplied `organizationId`. It currently uses the Node/Vercel singleton and has no explicit runtime declaration. It is not yet migrated.
- Sampled project, workspace, documents, and organization summary handlers preserve organization-scoped lookups and call `requireTenantContext` or `requireTenantRole` before tenant data access. These query scopes and authorization helpers must remain unchanged during any runtime migration.
- The Ops Next config currently externalizes `@prisma/client` only. OpenNext's workerd guidance lists Prisma's generated client and driver packages as runtime-sensitive packages; the final externalization list must be based on the generated Worker's actual dependency graph, not copied blindly from a different Prisma generator layout.
- The Ops Next config does not currently call `initOpenNextCloudflareForDev()`. Local `next dev` therefore has not been configured to provide OpenNext's Cloudflare bindings/context. This must be added and tested before using local development to validate binding access.

## Security and adapter compatibility gate — 2026-11-05

The pinned OpenNext Cloudflare adapter is @opennextjs/cloudflare@1.20.16. Its release notes raise the supported Next.js floor to **15.5.29 or 16.4.5** to include the November 3 security fixes. Both apps/marketing and apps/ops currently pin Next.js **16.4.3**, so the current build passing does not establish that this version is within the adapter's supported security floor.

Before any Workers runtime pilot or Preview deployment:
- Upgrade both Next.js app dependencies together to a supported patched version (at minimum 16.4.5, after checking the currently supported patch release).
- Regenerate pnpm-lock.yaml using the repository's pinned pnpm 10.18.0; do not hand-edit it.
- Re-run all monorepo checks and both OpenNext builds, then verify the adapter peer dependency is satisfied without warnings.
- Keep this change isolated in the existing Preview PR; do not change Production deployment configuration.

Reference: OpenNext Cloudflare 1.20.16 release notes and npm package metadata: https://github.com/opennextjs/opennextjs-cloudflare/releases and https://www.npmjs.com/package/@opennextjs/cloudflare.

## Integration constraints

1. Do not replace the package root export or mutate the existing Node/Vercel singleton.
2. Do not globally switch route runtimes or bulk-rewrite Prisma imports.
3. Keep the Workers factory in its isolated module. A future route-level integration must obtain `env` and `ctx` inside the request handler through `getCloudflareContext()`, and must pass the pooled Preview Neon connection string without exposing it to clients.
4. Keep database work awaited when the HTTP response depends on it. Schedule cleanup with the original `ctx.waitUntil(prisma.$disconnect())` method; do not destructure `waitUntil`.
5. Test success and failure cleanup behavior, transactions, Decimal/JSON serialization, concurrency, and real Neon connectivity in `workerd`. Wrangler dry-run alone is a bundle check, not a runtime database test.
6. Re-run tenant isolation tests with a legitimate organization member and a second tenant. Verify both allowed access and cross-tenant denial before considering any handler migration.
7. Validate the actual built Worker bundle's package resolution for the generated Prisma client and Neon adapter. Add `serverExternalPackages` entries only where required by the generated package graph and OpenNext's workerd conditional-export guidance.

## Recommended sequence

- Persist pinned `@prisma/adapter-neon` as a runtime dependency and regenerate `pnpm-lock.yaml` with pnpm 10.18.0; never hand-edit the lockfile.
- Add and test `initOpenNextCloudflareForDev()` in the Ops Next config, without enabling remote bindings or changing production resources by default.
- Add unit tests for the request-scoped factory, including operation rejection and disconnect scheduling.
- Run OpenNext Preview locally and issue a real query against the Neon Preview branch.
- Integrate the organization summary route as the first low-risk read-only pilot behind a route-local runtime-aware database boundary only after the above checks pass.
- Run authentication/session, tenant-isolation, R2/document, and browser E2E tests before expanding the integration.

## Platform note

Cloudflare's current documentation recommends vinext for new Next.js applications, while describing OpenNext as the adapter path for maintaining existing applications. This repository is using OpenNext as an isolated compatibility/Preview experiment for an existing Next.js monorepo; reassess the adapter choice before production adoption rather than treating this Preview foundation as a commitment to a platform migration.

## Explicitly out of scope

No Worker deployment, production database change, secret rotation, DNS/nameserver change, Vercel removal, PR merge, or tenant authorization change is authorized by this audit.


## Follow-up verification — commit `fd2203260ad671f0a539d60df8ac7f7443eedc1a`

Checked on 2026-11-05:
- PR #19 remains **Open + Draft**.
- All three PR-triggered GitHub Actions workflows for this exact commit completed successfully: Cloudflare Runtime Compatibility, Cloudflare Preview Runtime Build, and Monorepo quality gates.
- Both `apps/marketing/package.json` and `apps/ops/package.json` still pin `next` to `16.4.3`.
- The current stable npm release checked for this follow-up is Next.js `16.4.5`. This satisfies the OpenNext Cloudflare `1.20.16` minimum supported version and is the target for the paired app upgrade. Do not use a canary release for this compatibility fix.
- No dependency manifest or lockfile was changed in this follow-up. The connected repository actions can read and update text files, but the current execution environment has no repository working tree or pnpm runtime and no GitHub Actions workflow-dispatch/command-execution action. Therefore the lockfile cannot be regenerated and validated safely from this session. Updating only the two manifests would break the frozen-lockfile CI contract; manually editing `pnpm-lock.yaml` is prohibited.
- Vercel's PR status comments currently report `api-deployments-free-per-day` for Preview deployments. Treat this as an external deployment quota issue, separate from the successful GitHub Actions checks.

### Required next execution step

Run the paired upgrade in a repository working tree with pnpm `10.18.0`: set `next` to exact `16.4.5` in both app manifests, regenerate the root `pnpm-lock.yaml`, inspect the diff to ensure only intended Next.js resolutions/importers changed, then run frozen install, typecheck, tests, production builds, OpenNext builds, and Wrangler dry-run. Commit the manifests and generated lockfile together to this Preview branch. Until that step is completed, the security/compatibility gate remains **open** and no Workers route integration or deployment is approved.
