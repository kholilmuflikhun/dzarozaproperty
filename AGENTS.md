# Repository agent instructions

## Project architecture
- This is a pnpm 10.18 monorepo with Turborepo.
- Ops application: `apps/ops`.
- Shared database package: `packages/database` (Prisma + PostgreSQL).
- Preserve the existing Vercel deployment path while evaluating Cloudflare Preview.

## Cloudflare CLI and configuration
- When interacting with Cloudflare, use the `cf` CLI unless the target project already contains `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml`.
- For the Ops migration, first run the non-destructive `vinext check`; do not run `vinext init` until its compatibility report is reviewed.
- If `vinext init` is approved, review its generated `cloudflare.config.ts`, Vite config, scripts, dependency changes, and lockfile before committing.
- Do not add Wrangler configuration or use Wrangler deployment commands in the new `cf`-configured project.
- Pin CLI/tool versions in project dependencies when the setup is accepted; do not rely on an unreviewed global CLI.
- Use `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret for non-interactive CI. Never commit tokens or credentials.

## Security and environment boundaries
- Preview-only work is allowed on isolated Preview resources.
- Never read, write, migrate, or deploy Production resources unless the user explicitly authorizes that exact action.
- Never change DNS, custom domains, production traffic, or existing Vercel projects as part of Preview migration.
- Keep R2 buckets private. Never enable public `r2.dev` access.
- Do not expose secrets in logs, commits, pull request comments, or user-visible output.
- Preserve tenant-scoped authorization and test cross-tenant access explicitly.

## Database
- Keep Neon PostgreSQL as the system of record; do not replace it with D1.
- Use Cloudflare Hyperdrive only with a dedicated least-privilege Neon Preview role.
- Prisma on Workers must use a Cloudflare-compatible driver adapter (evaluate `@prisma/adapter-pg` with supported `pg`) and the Hyperdrive binding; the existing default Prisma client initialization is not sufficient.
- Run schema migrations only from CI against the intended Preview database using a separate direct connection. Never migrate from Worker runtime or Production.

## Changes and validation
- Use pnpm commands from the repository root and preserve the frozen lockfile workflow.
- Never hand-edit `pnpm-lock.yaml`.
- Keep stacked PRs Draft until their dependencies and acceptance gates are complete. Do not merge without explicit user approval.
- Validate with typecheck, tests, build, and relevant end-to-end smoke tests. Report what was actually run; do not present queued checks as passed.
- Prefer small, reversible changes and document any runtime compatibility gap before implementing workarounds.
