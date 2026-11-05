# Cloudflare Workers Database Runtime — Compatibility Spike

**Status:** Investigation complete; implementation gated  
**Date:** 2026-11-05  
**Related:** PR #19 — Cloudflare Preview Runtime Foundation

## Context

The repository currently uses a single shared database entrypoint:

- `packages/database/src/index.ts` exports a standard `PrismaClient` singleton.
- `packages/database/package.json` exposes that entrypoint as the package root.
- `packages/database/prisma/schema.prisma` uses `prisma-client-js` without `engineType = "client"`.
- Ops imports `@dzaroza/database` and runs on both the existing Vercel path and the proposed Cloudflare Workers path.

The current Prisma entrypoint must remain unchanged for Vercel until a separately tested migration is approved.

## Verified compatibility facts

1. Prisma ORM v6 supports engine-less client generation using `engineType = "client"`; this has been generally available since v6.16 and requires a driver adapter.
2. Prisma ORM v6 Cloudflare guidance documents `@prisma/adapter-pg` with `pg` for PostgreSQL over Cloudflare's Node.js socket compatibility, and documents `@prisma/adapter-neon` for Neon.
3. Cloudflare Hyperdrive provides a connection string binding and manages a warm connection pool in front of the origin database.
4. The current repository uses Prisma 6.19.x and Neon PostgreSQL. The production and Preview Vercel database paths are not to be replaced by this spike.

References:
- https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge/deploy-to-cloudflare
- https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/

## Proposed additive design

Keep the existing root export and default generator intact. Evaluate a second generated client dedicated to Workers, sourced from the same Prisma schema, with:

- a distinct generator name and output directory;
- `engineType = "client"`;
- an explicit adapter factory in a Workers-only entrypoint;
- a binding interface supplied by the Ops runtime boundary;
- Hyperdrive's `connectionString` passed to the adapter;
- no `cloudflare:workers` imports inside the shared database package;
- no implicit global singleton shared between Node/Vercel and Workers runtimes.

The exact generated-client import path and adapter constructor shape must be verified against the pinned Prisma 6.19.x packages before implementation. Do not hand-edit `pnpm-lock.yaml`.

## Required validation before wiring into Ops

1. Prove both Prisma generators can generate from the existing schema without changing the existing `@prisma/client` output or Vercel build.
2. Pin compatible versions of `@prisma/adapter-pg`, `pg`, and `@types/pg`; generate the lockfile using pnpm 10.18.0.
3. Add isolated adapter construction and connection tests against a non-production Preview database through Hyperdrive.
4. Validate pool/client lifecycle under concurrent Worker requests and confirm no connection leak or cross-request state.
5. Validate interactive transactions, nested writes, Decimal/JSON handling, and error mapping used by existing Ops services.
6. Run tenant-isolation tests through the Workers runtime, including cross-tenant denial.
7. Re-run Vercel Quality Gates and Cloudflare OpenNext build/dry-run.
8. Only then wire the Workers-specific database factory into Ops behind a runtime-specific boundary.

## Explicit non-goals

- No changes to the existing Prisma root singleton.
- No schema migration or database DDL.
- No Preview or Production secrets changes.
- No Cloudflare Worker deployment.
- No Vercel deployment configuration changes.
- No NextAuth, Midtrans, tenant authorization, or document lifecycle changes in this spike.

## Decision gate

This document records a proposed compatibility path, not approval to switch runtime or database infrastructure. Cloudflare runtime integration remains Preview-only until OAuth/session, tenant isolation, database, R2 document lifecycle, and Midtrans Sandbox end-to-end checks pass.
