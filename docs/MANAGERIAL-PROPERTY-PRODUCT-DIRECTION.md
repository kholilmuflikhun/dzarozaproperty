# Product Direction — Dzaroza Managerial Property OS

## Product vision

Dzaroza Property OS evolves into a property management operating system for property managers, residential estates, apartments, commercial buildings, and property service operators. The product supports internal use by Dzaroza and commercial use by independent customer organizations through the same multi-tenant codebase.

This is an additive product direction, not a replacement of the existing project, quotation, invoice, finance, identity, database, or storage architecture. Existing modules remain available and are extended into property-management workflows.

## UX reference analysis: Proyek Sat-Set

The supplied screenshots demonstrate several useful interaction patterns:
- A clear project selector and an obvious create-new action.
- A two-mode workspace separating data entry from generated documents.
- Numbered, horizontally scrollable document steps.
- Structured forms grouped into meaningful sections.
- A live A4 document preview with print/save and share actions.
- A persistent, reachable primary action area on mobile.
- A lightweight project form with collapsible sections and an example/demo entry point.

Dzaroza adapts these patterns to property management. It must not copy Proyek Sat-Set's construction-specific content or visual identity.

## Product design system

### Brand direction
- Base surfaces: white and warm off-white.
- Primary text and structural surfaces: near-black / charcoal.
- Accent: orange (#F97316), used for primary actions, active navigation, focus and important highlights.
- Supporting colors are semantic only: green for success, amber for warning, red for destructive/error states, neutral gray for secondary information.
- Do not add a competing palette or component library without an approved ADR.

### Responsive behavior
- Desktop: persistent left navigation, wide operational tables and multi-column dashboards.
- Tablet / iPad: compact header and horizontal navigation; forms use two columns where space allows.
- Mobile: single-column content, readable touch targets, horizontal step tabs, stacked cards and reachable actions.
- Document preview: responsive on-screen A4 fit while preserving true A4 print dimensions.
- Every workflow includes loading, empty, error, success and permission-denied states.
- Forms must support keyboard access, clear labels, validation feedback and draft-safe behavior.

## Domain adaptation

The project/workspace pattern becomes a property workspace. Core entities and workflows should be introduced incrementally and connected to existing Client, Project, Invoice, Payment, Organization, Membership, AuditLog and Document domain models where the semantics match.

Target capability areas:

1. **Portfolio & property registry:** properties, buildings, clusters, blocks, floors, facilities, assets and units.
2. **Owners, tenants & occupants:** people/organizations, contacts, unit occupancy, emergency contacts, and role-aware access.
3. **Contracts & leasing:** lease/management agreements, start/end dates, renewals, deposits, obligations and document history.
4. **Billing & collections:** recurring service charges, utilities/other charges, invoices, receipts, outstanding balances, reminders and collection history.
5. **Maintenance & work orders:** reports, priorities, assignment, SLA, schedules, vendor/technician, parts/costs, completion evidence and service history.
6. **Complaints & resident services:** ticket intake, categories, responsible team, status, communication log and resolution feedback.
7. **Inspections & compliance:** routine inspection schedules, checklists, findings, photos/files, corrective actions and follow-up.
8. **Operations & workforce:** tasks, shifts/assignments, vendors, security/cleaning/engineering operational checklists and handovers.
9. **Reports & management insights:** occupancy, arrears, collection, expenses, maintenance response, recurring issues and management performance.
10. **Document automation:** reusable templates for contracts, notices, invoices, receipts, work orders, inspection reports, handover minutes and management reports, with immutable versions and private archive.

These are product roadmap capabilities, not claims that all modules are already implemented. Each capability must have its own scoped phase, acceptance criteria and release gates.

## Product modes: internal use and SaaS

### Internal Dzaroza workspace
- Dzaroza can operate its own organization/tenant through the same authentication, tenant isolation and domain services as customers.
- Internal operation must not depend on hidden bypasses or shared cross-tenant data.
- Internal-only configuration must be explicit and auditable.

### SaaS customer workspace
- Each customer organization is an isolated tenant.
- Membership and role authorization remain the source of organization access.
- Plan entitlements and quotas are resolved server-side.
- A license key is an activation/entitlement artifact, never a login credential.
- Customer data remains isolated if a subscription expires; access may be restricted according to policy, but records are not silently deleted.

## Licensing and subscription model

The existing subscription, plan, entitlement, billing-event and license foundations should be reused. Do not create a second billing or licensing subsystem.

Commercial packaging should support:
- Monthly subscription.
- Annual subscription.
- Plan-controlled feature entitlements and limits.
- Trial or evaluation period only if explicitly configured and governed.
- License activation limits per plan.
- Owner/admin billing management.
- Audited status changes, payment events and entitlement evaluation.
- Upgrade/downgrade and renewal behavior defined before release.
- Grace period, past-due, suspended, canceled and expired states with clear customer-facing explanations.

Pricing is intentionally not fixed in this document. Pricing, quotas, feature matrix, tax treatment, grace period and cancellation/refund rules require a separate commercial decision and explicit configuration. Never hardcode pricing or infer a customer's entitlement from the UI.

## Architecture continuity requirements

- Continue the existing monorepo, Next.js App Router, TypeScript, Prisma/PostgreSQL, Neon, Vercel and Cloudflare R2 foundations.
- Reuse tenant context, RBAC, audit logging, validators, API conventions and shared components.
- Prefer additive schema evolution and preserve existing Project, Client, Invoice, Payment and Document records.
- For any new property entity, include organization ownership, access policy, unique constraints and tenant-isolation tests.
- Store financial amounts using Decimal and calculate trusted totals server-side.
- Store private documents in the existing private object storage pattern; use immutable snapshots and revision chains for legally or operationally important files.
- Do not treat client-side navigation or hidden controls as authorization.
- Any cross-module integration must have a single source of truth and transaction/idempotency strategy.

## Suggested phased roadmap

| Phase | Scope | Main outcome |
|---|---|---|
| A | Responsive UX foundation | Consistent shell, navigation, form patterns and document preview behavior |
| B | Property portfolio | Property/building/unit registry with tenant-safe relationships |
| C | Owner and occupant CRM | Contact records, occupancy, owner/resident relationships |
| D | Contract lifecycle | Management/lease agreements, renewal alerts and document templates |
| E | Billing and collections | Recurring charges, invoices, receipts, arrears and payment allocation |
| F | Maintenance & complaints | Work orders, tickets, SLA, assignments and service history |
| G | Inspection & operations | Checklists, schedules, evidence and corrective actions |
| H | Reports & automation | Management dashboards, scheduled reminders and operational reporting |
| I | SaaS commercialization | Plan matrix, monthly/yearly subscription lifecycle, license activation and customer onboarding |
| J | Release hardening | Security review, tenant-isolation E2E, accessibility, performance, backup/restore and UAT |

Phases may be split into smaller PRs. Their order can be adjusted only after dependency analysis; do not bypass security, data integrity or release gates.

## Acceptance requirements

A capability is not considered complete because a page or form exists. It must include:
- Approved workflow and role matrix.
- Server-side validation and tenant-scoped data access.
- Audit events for material actions.
- Unit and integration tests, including negative cross-tenant cases.
- Responsive behavior at mobile, tablet/iPad and desktop breakpoints.
- Accessibility and keyboard checks.
- Empty, loading, success, error and denied states.
- Migration review and compatibility verification.
- Preview deployment and end-to-end workflow validation.
- Documentation and UAT acceptance.

All changes must follow [Engineering Governance](./ENGINEERING-GOVERNANCE.md).
