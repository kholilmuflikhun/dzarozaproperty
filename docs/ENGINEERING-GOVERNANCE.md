# Engineering Governance — Dzaroza Property OS

## Purpose

This repository is one continuous product. Every phase extends the existing Dzaroza Property OS; it must not create a parallel application, duplicate domain logic, or replace established conventions without a documented and approved reason.

The governing principle is **evolutionary, backward-compatible development**: preserve product identity, architecture, domain contracts, user experience and operational workflows from the initial foundation through final release.

## Non-negotiable continuity rules

1. **One product, one architecture.** Extend the existing monorepo, apps, packages, services, authentication, tenant context, database access patterns and deployment model. Do not introduce a second app, competing service layer, duplicate ORM or alternative design system for a feature that belongs in an existing one.
2. **Preserve established conventions.** Inspect adjacent routes, components, schemas, tests, shared utilities and documentation before implementation. Follow their patterns unless a written Architecture Decision Record (ADR) approves a change.
3. **Additive by default.** Prefer additive schema changes, optional fields, compatible API extensions and incremental UI improvements. Avoid destructive migrations, renames, contract breaks and broad rewrites.
4. **Tenant isolation is mandatory.** Every organization-owned read, write, file operation, background task and document action derives authorization from authenticated server-side tenant context. A client-supplied organization ID is never proof of access.
5. **One source of truth per domain.** Reuse existing domain models and workflows. Do not create competing project, invoice, payment, document, client, subscription or entitlement records to support a new screen.
6. **Consistent experience.** Reuse existing navigation, page layouts, typography, spacing, colors, tokens, component primitives, form behavior, feedback patterns and responsive breakpoints.
7. **No silent scope changes.** Treat a new requirement as an update proposal. Record purpose, user impact, data impact, dependencies, security implications and acceptance criteria before implementation.
8. **Production is protected.** Preview validation, migration verification, security checks and UAT must pass before production migration, merge or deployment. Never use production data or credentials for Preview testing.

## Change classification

- **Class A — Compatible update:** additive feature, UI enhancement, optional field, report or workflow preserving existing contracts. Implement using established patterns and tests.
- **Class B — Internal refactor:** implementation changes without intended external behavior or contract changes. Prove behavior parity with regression tests and keep scope narrow.
- **Class C — Breaking or architectural change:** schema removal/rename, API contract change, auth/tenant model change, navigation redesign, design-system replacement, infrastructure replacement or potentially disruptive data migration. Requires an ADR, impact analysis, migration/rollback plan, explicit approval and staged rollout.

Do not implement Class C changes as routine feature work.

## Required workflow for every phase

1. **Baseline:** inspect current branch, architecture, relevant implementation, open PRs, tests, environment boundaries and conventions.
2. **Plan:** define scope, dependencies, non-goals, data/API/UI impact, risks and measurable acceptance criteria.
3. **Design:** reuse existing components and contracts. Add an ADR under `docs/adr/` for material architectural decisions.
4. **Implement:** make the smallest coherent change in the existing structure. Keep business rules on the server and reuse shared validators/services.
5. **Protect data:** use reviewed Prisma migrations. Prefer expand → backfill/dual-compatible operation → verify → contract only in a separately approved change. Never edit an already-applied migration; add a new migration.
6. **Test:** add/update unit, integration, tenant-isolation, authorization, regression and UI/E2E tests appropriate to the change.
7. **Document:** update module documentation, environment examples, operational notes and phase acceptance record.
8. **Review:** inspect the complete diff for duplicated logic, unintended behavior changes, accessibility, responsiveness, security and scope creep.
9. **Validate Preview:** run CI against the exact current commit, verify migration history and schema, deploy Preview, and test real workflows.
10. **Release:** obtain UAT acceptance and explicit release approval before production operations. Keep rollback and recovery steps available.

## Compatibility rules

### Database and Prisma
- Keep existing model identities and relations stable.
- Add nullable/defaulted fields where compatible; do not repurpose an existing column for a different meaning.
- Enforce organization ownership with server authorization and database constraints where appropriate.
- Preserve financial precision with Decimal; never use floating-point arithmetic for money.
- Keep migration files immutable after application. Correct mistakes with a new forward migration.
- Verify both physical schema and `_prisma_migrations` history; neither alone is sufficient.
- Test migration from the supported baseline and, where practical, from a fresh database.

### APIs and domain logic
- Preserve existing routes, request/response shapes and status semantics unless a versioned or explicitly approved transition is defined.
- Validate input at the boundary using existing conventions; calculate trusted totals and permissions server-side.
- Keep authorization in server handlers/services, not merely in UI visibility.
- Use idempotency and transactions for payment, invoice, approval, document revision and other state-changing workflows.
- Do not duplicate domain calculations between browser and server. Browser calculations are previews only; server values are authoritative.

### UI and design system
- Reuse current navigation, shells, components, icon library, tokens and interaction patterns.
- New functionality must be responsive and accessible, with consistent loading, empty, error, success and permission-denied states.
- Improve usability incrementally; do not redesign unrelated screens as collateral to a feature.
- Do not introduce a new palette, typography system, component library or navigation model without an approved design decision.

### Integrations and infrastructure
- Reuse established Neon, Vercel, Cloudflare R2, authentication and payment integrations.
- Keep secrets in the correct environment and never commit, print or expose them.
- Keep Preview and Production isolated. A Preview success is not permission to modify Production.
- Background jobs and webhooks must be authenticated/verified, idempotent, observable and tenant-safe.

## Architecture Decision Records

Create an ADR for every Class C change and material cross-module decision. Each ADR must include context/problem, options and rationale, chosen approach, affected modules/API/database/workflows, compatibility and migration strategy, security/tenant/privacy impact, tests, rollout, monitoring, rollback, approval and date.

An ADR documents a decision; it does not itself authorize production deployment.

## Definition of Done

A phase is complete only when all applicable conditions are satisfied:

- Scope and acceptance criteria are met without unrelated regressions.
- Existing architecture and design conventions are preserved.
- Database changes are additive or have an approved ADR and safe migration plan.
- Authorization and tenant-isolation tests pass, including negative cross-tenant cases.
- Unit and integration tests pass; UI/E2E coverage exercises the real user workflow.
- TypeScript, lint/schema validation and production builds pass on the exact PR head.
- Preview deployment is healthy and affected workflows are tested against Preview.
- Migrations are applied and Prisma history is verified.
- Accessibility, responsive behavior and loading/error/empty states are checked.
- Documentation and operational instructions are current.
- No unresolved critical/high severity security or data-integrity defect remains.
- UAT is accepted before the release phase.

A queued workflow, an older green run, a successful local build, or a schema-only check does not satisfy this definition.

## Update and release policy

- Treat all future requests as updates to the existing Dzaroza Property OS baseline.
- Preserve existing functionality by default. If a new requirement conflicts with existing behavior, document the conflict rather than silently replacing it.
- Keep changes focused and traceable through branch, PR, commit, tests and documentation.
- Do not merge a draft PR or deploy to Production until relevant acceptance gates pass and release approval is explicit.
- For a necessary breaking change, provide a compatibility window where possible, a data migration plan, rollback strategy and clear operator/user communication.
- At each release, record baseline commit, migrations, environment/configuration changes, known limitations and rollback point.

## Final product principle

The final Dzaroza Property OS must feel like one coherent platform: one identity, one navigation language, one design system, consistent domain rules, predictable data contracts and secure tenant boundaries. New capabilities are layered onto that foundation as controlled updates—not as disconnected redesigns or parallel implementations.
