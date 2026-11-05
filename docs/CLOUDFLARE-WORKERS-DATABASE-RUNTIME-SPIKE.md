# Cloudflare Workers Database Runtime — Compatibility Spike

**Status:** Compatibility decision recorded; implementation gated  
**Date:** 2026-11-05  
**Related:** PR #19 — Cloudflare Preview Runtime Foundation

## Context

The repository currently uses one shared Node/Vercel database entrypoint:

- `packages/database/src/index.ts` exports the standard `PrismaClient` singleton.
- `packages/database/package.json` exposes that entrypoint as the package root.
- `packages/database/prisma/schema.prisma` uses `prisma-client-js` with the Rust query engine.
- Ops imports `@dzaroza/database`.
- The repository's PostgreSQL provider is Neon.

The existing package root, generated default client, and Vercel runtime must remain unchanged.

## Compatibility findings

1. Prisma ORM v6.16+ supports Rust-free clients with `engineType = "client"`; a driver adapter is required.
2. Prisma's Cloudflare Workers guidance requires Prisma ORM 6.19+ for its Prisma Postgres serverless driver and shows a `prisma-client` generator with `runtime = "workerd"`.
3. For a Neon database, Prisma documents `@prisma/adapter-neon`. For a conventional PostgreSQL TCP endpoint, Prisma documents `@prisma/adapter-pg` with `pg`; Cloudflare Hyperdrive is a suitable pooling layer for that TCP path.
4. The existing database is Neon, so the first Workers compatibility spike should test the Neon adapter directly. Do not introduce Hyperdrive as an extra hop without a measured requirement.
5. OpenNext is the current isolated Cloudflare build path for this existing Next.js app. Cloudflare recommends vinext for new Workers Next.js applications, but migrating this existing app is a separate architecture decision.
6. Cloudflare's `cloudflare:workers` binding import is documented for vinext. Do not copy that API into the current OpenNext app. OpenNext binding access must use its documented `getCloudflareContext` integration and be tested in the actual app runtime.

References:
- https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge/deploy-to-cloudflare
- https://www.prisma.io/docs/orm/v6/overview/databases/neon
- https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge/deploy-to-cloudflare
- https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/no-rust-engine
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- https://opennext.js.org/cloudflare/bindings

## Decision: additive Neon-first Workers client

Keep the existing generator and root export intact. A second generator has now been added to the same schema on PR #19. On commit `5afee8b62ae4cbba4a9259326646abbcb1d0c1b2`, the Monorepo Quality Gates workflow completed Prisma schema validation and both-client generation successfully. This verifies schema/generator compatibility in CI; it does not yet verify a Workers database connection, adapter behavior, or runtime execution:

```prisma
generator workers {
  provider   = "prisma-client"
  output     = "../generated/workers"
  engineType = "client"
  runtime    = "workerd"
}
```

The Workers-only adapter path uses `@prisma/adapter-neon@6.19.3` against the existing Neon Preview branch. An isolated factory now exists at `packages/database/src/workers.ts`; it creates a fresh client for each request and exposes `withWorkersPrisma()` to await the operation before scheduling `$disconnect()` with the request context's `waitUntil()`. It does not change the Node/Vercel package root. CI installs the adapter ephemerally for typechecking, without persisting package or lockfile changes. Keep Cloudflare runtime binding retrieval at the Ops application boundary.

Important constraints:

- Do not import `cloudflare:workers` in this OpenNext application or shared database package.
- Do not replace `@dzaroza/database` root export or the existing Node/Vercel singleton.
- Do not use a module-global Prisma client in the Workers path. Prisma's Cloudflare guidance warns that reusing a module-level client/socket across requests can hang subsequent requests. Create the client per request; `withWorkersPrisma()` awaits database work and schedules `$disconnect()` through `ctx.waitUntil()` in `finally`.
- Do not assume the `pg`/Hyperdrive lifecycle is interchangeable with the Neon serverless adapter.
- Keep the Workers client output separate from the existing `@prisma/client` output.
- Keep the same Prisma schema and migration history; this work must not create or apply DDL.
- The exact adapter constructor and connection lifecycle must be checked against pinned Prisma 6.19.3 package types and tested in workerd.

## Implementation prerequisites

1. **Completed in CI:** validate the existing schema and generate both Prisma clients with the repository's pinned Prisma toolchain. A byte-for-byte comparison of the generated Node client against the previous output has not been performed.
2. **Compatibility scaffold added:** `packages/database/src/workers.ts` creates a request-scoped Prisma client with `PrismaNeon`; the exact adapter is installed ephemerally in Quality Gates for typechecking.
3. **Lifecycle helper added:** `withWorkersPrisma()` accepts a minimal request context with `waitUntil()`, awaits the database operation, then schedules `$disconnect()` in `finally`.
4. Regenerate `pnpm-lock.yaml` with pnpm 10.18.0 before persisting the adapter dependency; never handcraft the lockfile.
5. Wire the factory only at the Ops request/runtime boundary, using the documented OpenNext binding API and a pooled Neon Preview connection string.
5. Prove connection lifecycle, query behavior, transaction support, Decimal/JSON handling, and concurrency in workerd; no live database connection test has passed yet.
6. Verify OAuth callbacks, session persistence/refresh/logout, admin revocation, tenant isolation, R2 document lifecycle, and Midtrans Sandbox in the same runtime before considering app integration.
7. Re-run Vercel Quality Gates and Cloudflare OpenNext build/dry-run.

## Hyperdrive alternative

If testing shows the Neon serverless adapter is unsuitable for the target workload, evaluate a separate Hyperdrive + `@prisma/adapter-pg` path. This requires an explicit decision on the upstream PostgreSQL endpoint, pooling behavior, Worker compatibility, and Neon connection limits. Do not configure a Hyperdrive binding or secrets as part of this spike.

## Explicit non-goals

- No changes to the existing Prisma root singleton or Vercel runtime.
- No schema migration, database DDL, or Preview database mutation.
- No Cloudflare secrets, Hyperdrive resource, or Worker deployment.
- No Vercel deployment configuration changes.
- No NextAuth, Midtrans, tenant authorization, or document lifecycle changes.

## Decision gate

This is a compatibility decision, not authorization to switch infrastructure. Cloudflare remains Preview-only until the full runtime E2E acceptance suite passes. PR #19 remains Draft until its scope is complete and reviewed.


## Ops integration boundary audit (2026-11-05)

The current application is not ready to switch its shared database import to the Workers client:

- `packages/database/src/index.ts` exports a module-level `PrismaClient` singleton from `@prisma/client` for the existing Node/Vercel runtime.
- Ops API routes currently import `prisma` from `@dzaroza/database`; at least the Project Workspace document API route explicitly declares `export const runtime = "nodejs"`.
- The Workers generator and `withWorkersPrisma()` are isolated and are not wired into these existing routes.

Do not replace the package root export or globally switch route runtimes as part of this spike. The next integration step must introduce an explicit runtime-aware database boundary while preserving the Node/Vercel singleton, and prove it with route-level tests on both runtime paths. Audit all Ops Prisma consumers and runtime declarations before changing any route. Keep tenant authorization helpers and query scopes unchanged.
