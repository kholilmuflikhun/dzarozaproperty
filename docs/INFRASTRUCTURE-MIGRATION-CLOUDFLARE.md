# Cloudflare Infrastructure Migration Plan

## Target architecture

| Layer | Target | Decision |
|---|---|---|
| Application runtime | Cloudflare Workers | Next.js App Router compatibility must pass before cutover |
| Next.js adapter | vinext first | Cloudflare-recommended, currently beta; preserve existing Next.js path while evaluating |
| Static assets | Workers Static Assets | Serve app assets through the Worker deployment |
| Object storage | Cloudflare R2 | Private buckets, separate per environment |
| Relational database | Neon PostgreSQL | Remains the only relational source of truth |
| ORM | Existing Prisma | Preserve current schema and services; verify runtime/driver compatibility |
| Domain registrar | Jagoan Hosting | Remains unchanged |
| DNS / custom hostname | Cloudflare DNS only if required | No nameserver or DNS changes without approved cutover |
| SaaS licensing | Existing Dzaroza domain services + Neon | Tenant-safe plans, entitlements, billing and license activation |

## Verified Cloudflare account inventory (2026-11-05)

- The connected Cloudflare account is accessible.
- R2 buckets already exist: dzaroza-ops-dev, dzaroza-ops-preview, and dzaroza-ops-prod.
- Created the `dzaroza-property` workers.dev subdomain.
- Created Worker script `dzaroza-ops-preview`, bound to the existing private `dzaroza-ops-preview` R2 bucket. This is a bootstrap/health-check Worker only; it deliberately returns HTTP 503 for application routes until the real Next.js bundle is validated and deployed. It is not the production application.
- Created Cloudflare DNS Zone for `dzarozaproperty.id` (Zone ID: `e2bf381eeb509807b6cd5d7e0e3f8aa1`), currently `pending`.
- Assigned Cloudflare nameservers: `keanu.ns.cloudflare.com` and `mckenzie.ns.cloudflare.com`.
- Cloudflare reports original registrar as PT Jagoan Hosting Indonesia and original authoritative nameservers as `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
- Ran Cloudflare DNS scan; 10 website-related records were discovered/imported (6 A, 3 CAA, 1 CNAME). The A records point to Vercel infrastructure; `_domainconnect` points to Vercel DNS. No MX or TXT records were returned by this scan. This is not proof that mail/security TXT records do not exist at the current authoritative DNS provider.
- The Cloudflare zone is not authoritative yet. Nameservers remain unchanged at Vercel DNS. Do not switch nameservers until the full current DNS zone (including mail MX, SPF, DKIM, DMARC, verification TXT, subdomains and DNSSEC/DS status) has been exported and compared.
- No database migration, Production deployment, DNS nameserver change, or Production resource modification was performed.

## Runtime migration strategy

1. Preserve current Next.js 16.4.3 app and scripts.
2. Run the Cloudflare vinext compatibility checker on the actual application in apps/ops. The current Cloudflare guide recommends vinext but labels it beta; compatibility dashboard review is required.
3. If a blocking compatibility gap exists, record it and evaluate OpenNext only as a fallback. Do not silently rewrite the app or replace the monorepo.
4. Add a separate Cloudflare build/deploy path and Cloudflare type generation only after the compatibility check has a reviewed result.
5. Use workers.dev for the first isolated Preview. Configure Worker bindings to the Preview R2 bucket and Neon Preview credentials.
6. Test: NextAuth/session lifecycle, Google OAuth callback URLs, Prisma database access, tenant authorization, PDF generation, R2 upload/finalization/download, document revisions, invoices, Midtrans webhook signature/idempotency, and all organization-scoped APIs.
7. Verify mobile/tablet/desktop UI and document print output against the existing UX acceptance checklist.
8. Only after Preview acceptance prepare production secrets, production R2 binding and domain routing.

## R2 storage rules

- Keep all project and customer documents private.
- Keep environment buckets separate; never allow Preview credentials to access Production buckets.
- Preserve current object keys and metadata during the migration.
- Use short-lived presigned URLs or authenticated Worker-mediated access; never expose R2 credentials to browsers.
- Continue verifying content type, size, object ownership, organization/project scope and SHA-256 where currently required.
- Maintain immutable document revision chains and audit logs.
- Determine whether any current Vercel Blob objects exist before deciding on a copy/migration. Do not assume an empty source store.
- Keep R2 S3 API endpoint, access key and secret as environment secrets; rotate only with a planned dual-key window.

## Domain and DNS

Jagoan Hosting remains the domain registrar/provider. Cloudflare Workers custom domains generally require the hostname to be managed through Cloudflare DNS. Cloudflare Zone `dzarozaproperty.id` now exists in pending state. Its assigned nameservers are `keanu.ns.cloudflare.com` and `mckenzie.ns.cloudflare.com`. The registrar remains Jagoan Hosting and the currently reported authoritative nameservers are still Vercel DNS. The safe sequence is:

1. Keep the current domain and DNS configuration untouched; Cloudflare zone remains pending.
2. Use the Worker bootstrap only for isolated Preview checks; deploy the actual Next.js application only after runtime compatibility passes.
3. Export the complete live DNS zone from the currently authoritative provider (currently reported as Vercel DNS), not merely the 10 records found by Cloudflare's scan.
4. Confirm email provider records: MX, SPF, DKIM selectors, DMARC, mail/autodiscover records and any third-party verification TXT records. The DNS scan did not return these, so do not infer they are unnecessary.
5. Check DNSSEC DS at the .id registry/registrar and plan its safe handling before delegation.
6. Compare every source record with Cloudflare's imported records; preserve TTLs and proxy settings intentionally. Review Vercel apex/www/wildcard records before changing anything.
7. Registrar ownership remains at Jagoan even if authoritative DNS is later delegated to Cloudflare.
8. Obtain explicit approval before changing nameservers or DNS records.

## Free-tier and cost controls

- Treat Cloudflare Free as a target budget, not a guarantee of zero cost. Check current Workers, Builds and R2 usage limits and account billing before release.
- R2 currently has a no-egress-fee model; storage and operation allowances/charges still need workload-based verification.
- Set budget/usage alerts where available and monitor Worker request, CPU, storage and operation usage.
- Do not put customer-specific Workers or buckets on a separate per-customer account; use application-level multi-tenancy and server-side entitlements.

## Environment and secrets matrix

| Variable / binding | Development | Preview | Production |
|---|---|---|---|
| Neon database URL | Dev DB/branch | Existing Neon Preview | Existing Neon Production |
| R2 bucket | dzaroza-ops-dev | dzaroza-ops-preview | dzaroza-ops-prod |
| R2 credentials/binding | Dev only | Preview only | Production only |
| Auth URL / OAuth callbacks | Local | Preview hostname | Production hostname |
| Auth secrets | Dev | Preview | Production |
| Midtrans | Sandbox | Sandbox | Production only after release approval |
| Upload signing / webhook secrets | Dev | Preview | Production |

Never copy Production credentials into Preview. Store secrets in the environment-specific Cloudflare Worker secret store or CI secret store, never in source control.

## Acceptance checklist

- [ ] vinext compatibility report saved and all blockers resolved or documented.
- [ ] Cloudflare Worker build succeeds for the monorepo app root.
- [ ] Worker Preview deploys and serves the actual app.
- [ ] NextAuth login, refresh, logout and OAuth callbacks pass.
- [ ] Tenant isolation passes positive and negative cross-tenant tests.
- [ ] Neon Preview queries and Prisma migrations/history pass.
- [ ] R2 upload, finalization, private download and revision chain pass.
- [ ] PDF generation and A4 print output pass.
- [ ] Invoice/payment and Midtrans sandbox webhook tests pass.
- [ ] Responsive UI and browser E2E pass at 360, 768, 1024 and desktop widths.
- [ ] Logs, errors, rate limits and rollback are verified.
- [ ] DNS inventory and cutover plan reviewed; no changes until approval.
- [ ] UAT accepted.
- [ ] Explicit Production cutover approval recorded.

## Current status

Planning and account inventory are complete. No Worker was deployed, no DNS zone or record was created, no nameserver was changed, no database migration was run, and no Production resource was modified. The next implementation gate is the actual vinext compatibility check and runtime dependency audit from the repository workspace.
