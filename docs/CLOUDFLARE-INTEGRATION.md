# Cloudflare Integration — Dzaroza Property OS

## Status and scope

This integration is intentionally additive. The existing Next.js applications remain deployed on Vercel and PostgreSQL remains on Neon. Cloudflare R2 is the target object store for the Ops document-management system (DMS); the existing Marketing app continues using Vercel Blob until a separately tested migration is approved.

This document does not authorize DNS/nameserver changes, production traffic changes, or replacement of the existing Vercel project.

## Current provider state (verified 2026-11-03)

- Cloudflare account authentication is available.
- The authenticated account currently has no DNS zones.
- Cloudflare API returned error 10042 for the R2 buckets endpoint: R2 must first be enabled in the Cloudflare Dashboard.
- No R2 bucket or access key has been provisioned by this integration.
- The dedicated Vercel Ops Preview project already exists: `dzaroza-ops-preview` (see `docs/PREVIEW-VERIFICATION.md`). Keep it isolated from the existing Marketing/production Vercel project.
- The worker workspace is currently a Node.js placeholder. Do not silently convert it into a Cloudflare Worker; choose a queue/runtime adapter only after the use case and deployment model are reviewed.

## Target architecture

| Concern | Provider | Policy |
|---|---|---|
| Marketing website | Vercel | Keep current deployment and Vercel Blob integration |
| Ops application | Vercel | Dedicated Ops Preview project; production project only after separate release approval |
| Relational data | Neon PostgreSQL | Keep existing tenant-scoped Prisma data model |
| Ops documents | Cloudflare R2 | New storage provider behind an application storage interface |
| DNS / edge security | Cloudflare | Optional after domain zone is deliberately onboarded |
| Source and CI | GitHub Actions | Least-privilege CI; no credentials committed |

## Environment isolation

Create separate private buckets only after R2 is enabled:

- `dzaroza-ops-dev`
- `dzaroza-ops-preview`
- `dzaroza-ops-prod`

Never share write credentials between environments. Preview must not point to production bucket or production Neon database. Production bucket creation and credentials require a separate release approval.

## R2 provisioning checklist

1. In Cloudflare Dashboard, select the intended account and enable R2.
2. Confirm the account's R2 location/jurisdiction requirements before creating buckets.
3. Create the three private buckets listed above; do not enable public `r2.dev` access.
4. Create scoped S3 API credentials for the required bucket and environment. Store secret access keys only in the corresponding Vercel environment.
5. Configure CORS only for the exact Ops Preview origin and required methods/headers. Add production origins only during the production rollout.
6. Prefer short-lived presigned PUT/GET URLs. The application must authorize the user and organization before issuing a URL.
7. Persist object key, tenant/organization ID, original filename, media type, byte size, checksum, uploader and timestamps in PostgreSQL. Do not treat an object key or URL as authorization.
8. Validate file size, allowed MIME types, file signatures where practical, generated object keys, and tenant ownership. Never accept client-supplied bucket names or arbitrary object keys.
9. Keep buckets private. Serve downloads through short-lived signed URLs or an authorized application proxy.
10. Add lifecycle/retention rules only after legal, operational and backup requirements are agreed.

## Application integration contract

The Ops application should depend on a provider-neutral storage contract, not the AWS SDK or Cloudflare API throughout business logic. The first adapter will be an S3-compatible R2 adapter. The adapter should expose operations for creating a short-lived upload URL, creating a short-lived download URL, deleting an object, and checking object metadata.

The upload flow must be:

1. Authenticated user requests an upload for a specific tenant-owned record.
2. Server resolves tenant membership and role from the authenticated session.
3. Server validates file metadata and creates a random, non-guessable object key scoped by tenant.
4. Server returns a short-lived presigned upload URL.
5. Browser uploads directly to R2.
6. Server verifies the resulting object metadata and records the document row in a tenant-scoped database transaction.
7. Downloads repeat authorization checks before issuing a short-lived URL.

Do not trust a browser-provided `organizationId`, filename, content type, file size or object key as proof of authorization. Avoid logging signed URLs, access keys, bearer tokens or document contents.

## Environment variables

Configure these only in the matching Vercel project/environment after bucket and credential provisioning:

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_PUBLIC_BASE_URL` — optional; leave unset while buckets are private.

Use separate values for Development, Preview and Production. Never put real values in GitHub, source files, PR descriptions or chat. Do not copy credentials from Marketing's Vercel Blob configuration.

## Queue and worker decision

Do not replace the existing Node worker placeholder yet. When an asynchronous requirement is implemented, use a transactional outbox in Neon and idempotent consumers. Select Cloudflare Queues only if a Cloudflare Worker consumer is an operational fit; use Workflows only for durable multi-step orchestration. The queue publisher must not assume a database commit and queue publish are one atomic operation. Include retry limits, dead-letter handling, event versioning and observability.

## DNS and security policy

The current Cloudflare account has no zones. Do not change nameservers or proxy the production domain until the authoritative DNS records, mail records, verification records, origin routing and rollback plan are inventoried. Cloudflare WAF/rate limiting may be enabled only after the zone is onboarded and rules are tested against the Vercel origin. Preserve existing application security headers and test CSP before changing it.

## Acceptance criteria

- [ ] R2 is enabled in the intended Cloudflare account.
- [ ] Private dev/preview/prod buckets exist with isolated credentials.
- [ ] Ops Preview has only Preview bucket credentials and a dedicated non-production Neon database.
- [ ] Provider-neutral storage interface and R2 adapter pass unit tests.
- [ ] Upload/download authorization is tenant-scoped and tested for cross-tenant denial.
- [ ] MIME/size validation, short URL expiry, private access and metadata persistence are verified.
- [ ] No signed URLs or secrets appear in logs.
- [ ] Preview E2E tests pass before production configuration.
- [ ] Marketing Vercel Blob remains unchanged until a separate migration plan is approved.
- [ ] No production DNS, deployment or credential change occurs without explicit release approval.
