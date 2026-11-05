# Dzaroza Property OS — Master Implementation Plan

**Status date:** 2026-11-05  
**Source of truth:** this document plus the linked implementation record and engineering governance.  
**Production policy:** no direct changes to `main`, Production database, production deployment, or DNS without explicit approval.

## Product objective

Deliver a multi-tenant Property Management Operating System for Dzaroza's internal operation and independent property-management organizations. The platform must reuse the existing identity, organization, membership/RBAC, subscription, audit, financial, project, document, and storage foundations.

## Release principles

A phase is not complete because its UI or API exists. Completion requires:
- tenant-scoped server authorization and database ownership constraints;
- role matrix and validated server inputs;
- atomic audit events for material mutations;
- unit and PostgreSQL-backed integration tests, including cross-tenant negative cases;
- responsive and accessible UX with loading, empty, success, error, and denied states;
- migration validation, CI, Preview deployment, browser E2E, and UAT;
- documentation, operational monitoring, and rollback strategy.

## Master phase map

| Phase | Scope | Deliverables | Exit gate |
|---|---|---|---|
| 0 | Monorepo foundation | Marketing/Ops apps, pnpm workspace, CI, Prisma baseline | reproducible install/build and Preview smoke tests |
| 1 | Identity & SaaS foundation | OAuth, organizations, memberships, RBAC, subscriptions, licensing, entitlements | auth/payment callback tests and tenant-boundary tests |
| 2 | Business & finance workflows | CRM, quotation approval, project conversion, invoices, payments, finance dashboard | PostgreSQL integration tests and business-flow E2E |
| 3 | Project workspace & document engine | workspace, work items, payment terms, change orders, progress reports, private document archive, PDF and revisions | tenant-safe document E2E, R2 verification, document UAT |
| 4 | Property portfolio & asset registry | properties, buildings, units, asset register and tenant-scoped APIs | migration + CRUD + cross-tenant tests + responsive portfolio UI |
| 5 | Owner, tenant & occupant management | owner/resident profiles, occupancy, contacts, move-in/out and relationship history | occupancy invariants, role tests and UAT |
| 6 | Contract & lease lifecycle | management/lease contracts, templates, renewals, deposits, obligations | immutable contract history and renewal E2E |
| 7 | Billing & collection management | recurring charges, utility/service billing, invoice schedules, receipts, arrears | ledger reconciliation, idempotency and payment E2E |
| 8 | Maintenance & complaint management | tickets, work orders, priorities, SLA, vendors, costs and evidence | end-to-end service lifecycle and SLA reports |
| 9 | Inspection & compliance | checklists, schedules, findings, photos, corrective actions | evidence retention and corrective-action workflow |
| 10 | Operations & workforce | tasks, shifts, handovers, security/cleaning/engineering checklists | assignment, completion and audit tests |
| 11 | Reports, automation & intelligence | occupancy, collection, arrears, expense, maintenance and scheduled reminders | metric definitions, tenant isolation and job idempotency |
| 12 | SaaS commercialization | plan matrix, onboarding, upgrades, renewals, grace/suspension and usage quotas | entitlement and subscription lifecycle E2E |
| 13 | Release hardening | security, performance, accessibility, backup/restore, monitoring, disaster recovery and UAT | signed release checklist and rollback rehearsal |

## Phase 3 — closeout status

The current development line contains the Project Workspace and Automated Document Engine. It includes project workspace data, work items, payment terms, change orders, progress reports, private document storage, PDF generation, and document revision chains.

Additional database integrity guards prevent multiple active child revisions for one parent and duplicate active root documents for a project/document identity. The corresponding Preview migration history and indexes were verified on 2026-11-05. CI on commit `782728d7cf74c5953c8f878e1094c64fd31c5b9d` passed Prisma validation/generation, migration and tenant-constraint checks, TypeScript, unit tests, both production builds, and Marketing/Ops smoke tests.

**Still required before Phase 3 is called production-ready:** current Preview deployment verification, authenticated browser E2E for permitted and denied tenant access, upload-complete/download/PDF/revision workflow testing, and user acceptance. A successful CI run is not a substitute for those checks.

## Phase 4 — Property Portfolio & Asset Registry

### Domain model

- `Property`: organization-owned property identity, type/status, address, coordinates, land/building area.
- `PropertyBuilding`: building/cluster/block identity under a property.
- `PropertyUnit`: unit identity, type, availability/occupancy status, floor and area metadata.
- `PropertyAsset`: physical asset register, category, serial, location, lifecycle status, acquisition and purchase cost.

### Implemented foundation in this branch

- Additive Prisma models and enums.
- PostgreSQL migration with organization ownership, composite foreign keys, tenant-scoped uniqueness and indexes.
- Database checks for coordinate ranges and non-negative areas, floors, unit counts and asset cost.
- Tenant-authorized property list/create API with filters and portfolio summary counts.
- Tenant-authorized building, unit, and asset list/create APIs.
- Atomic audit records for property, building, unit, and asset creation.

### Remaining Phase 4 scope

- Property detail/update/archive workflows.
- Building, unit and asset update/retirement workflows.
- Cursor pagination and search for large portfolios.
- Property portfolio UI, detail tabs, responsive forms and empty/error states.
- PostgreSQL-backed integration tests proving composite tenant ownership and cross-property/building rejection.
- CI, Preview migration, deployment and browser UAT.

### Important domain boundary

Owner and occupant identity/occupancy must be implemented in Phase 5, not duplicated as free-text owner fields in Phase 4. Project-to-property linking should be added only with an explicit relationship rule and migration plan. Existing Client, Project, Invoice, Payment, and Document records remain intact.

## Dependency map

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3
                           ↘
                            Phase 4 → Phase 5 → Phase 6
                                              ↘
                         Phase 7 ←──────────────
                           ↓
                  Phase 8 → Phase 9 → Phase 10
                           ↓
                       Phase 11 → Phase 12 → Phase 13
```

Phases 4–10 may be delivered as smaller pull requests, but shared entity ownership and transaction boundaries must be agreed before implementation. Do not bypass security or release gates to accelerate feature count.

## Environment and release gates

- Development and Preview use isolated Neon branches and separate credentials.
- Preview migrations are applied through the approved CI workflow after duplicate/data preflight.
- Vercel remains the supported application runtime until a separate Cloudflare compatibility project passes auth, database, storage, PDF, webhook, and browser E2E.
- No Production migration, merge to `main`, production deployment, DNS/nameserver change, or destructive data operation without explicit user approval.
