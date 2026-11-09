# Main Branch Reconciliation

## Decision

The pnpm/Turborepo monorepo is the target architecture for `main`. The existing root-level Vinext/Vite Cloudflare application is treated as a legacy deployment line and is not copied wholesale into the monorepo.

## Reconciliation baseline

- Monorepo baseline: `6701d6e0018990622ee2a24650f0e26e535f395b`
- Previous `main` head reviewed: `afcac611c3376552a5ccf6be81ca9e1022a9240c`
- Common ancestor: `39d2c14fdf0dcd5db1970adf8a62dcf0369680f1`
- The two histories diverged. The monorepo contains the Marketing, Ops, Worker, shared packages, Prisma schema/migrations, and workspace configuration.

## Disposition of the 13 commits on legacy main

| Change area | Decision | Reason |
| --- | --- | --- |
| Cloudflare/Vinext production workflow and Vite config | Do not port as an active deployment workflow | It builds and deploys the legacy root app, not the monorepo workspace targets. |
| Better Auth + D1 auth implementation and migration | Do not port | The monorepo Ops and Marketing apps use NextAuth with Prisma/PostgreSQL. Mixing session systems or auth stores without a designed migration would create account/session and data-integrity risk. |
| Legacy root package and pnpm 9 lockfile changes | Do not port | The monorepo already pins pnpm 10.18.0 and uses workspace lockfile v9; legacy root package scripts and dependencies are not the workspace contract. |
| Quotation PostgreSQL tenant-isolation integration test | Preserve | The integration test is already present under `apps/ops/src/app/api/organizations/[organizationId]/quotations/route.integration.test.ts`. |
| Legacy app copy, footer, PostCSS, and local-env documentation changes | Do not port mechanically | These are tied to the old root application. Equivalent workspace-specific configuration and documentation remain authoritative. |
| Node 26 pin | Do not port | Workspace packages declare Node `>=22 <25`; CI uses Node 22 to satisfy package engines. |

## CI remediation

The document metadata API's authorization implementation returns the canonical `ForbiddenError` message from `apps/ops/src/lib/errors.ts`. The previous test mock returned a shorter, inconsistent message, causing two response-body assertions to fail while HTTP 403 behavior was correct.

The reconciliation branch aligns the mock with the production error contract and explicitly verifies that denied tenant access stops before database queries or R2 storage reads. Authorization logic and tenant boundaries are unchanged.

## Deployment boundary

- Keep Cloudflare DNS and existing infrastructure untouched during code reconciliation.
- Do not run the legacy `cloudflare-production.yml` workflow from the monorepo.
- Marketing and Ops Preview builds must pass before changing the Production Vercel Root Directory.
- Do not deploy Prisma migrations to the Production database as part of CI or Preview validation.
- Production promotion is a separate final gate after CI, Preview smoke tests, environment-variable review, and deployment configuration validation.
