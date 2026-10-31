# Staging Deployment and Integration Runbook

This runbook prepares the Ops application for a controlled staging deployment. It is a checklist, not evidence that any external service has already been configured or tested.

## 1. Deployment topology

Create a **separate Vercel project** for Ops from this repository:

- Root Directory: `apps/ops`
- Framework: Next.js (allow Vercel to detect it)
- Production Branch: keep the repository's existing `main` branch; do not promote this feature branch to production.
- Preview deployment: enable deployments for `feat/monorepo-saas-foundation` only after staging environment variables and the staging database are ready.
- Keep the existing Marketing Vercel project separate with Root Directory `apps/marketing`.
- Do not point either project at the production database during staging.

The repository uses pnpm workspaces. Keep workspace installation/build context available to the root workspace; if Vercel asks about including files outside the root directory, enable the applicable workspace option. Confirm the detected install/build commands against the repository's root scripts before overriding them.

Use a dedicated staging hostname, for example `ops-staging.<your-domain>`. Do not use a production hostname for this exercise.

## 2. Ops environment variables

Configure these in the **Ops Vercel project Preview environment only**. Use the same values for the staging preview URL and the configured custom staging domain as appropriate.

| Variable | Staging value / rule |
|---|---|
| `NEXTAUTH_URL` | Exact HTTPS origin of the Ops staging hostname, without a trailing path |
| `NEXTAUTH_SECRET` | Generate a unique high-entropy secret; never reuse the CI placeholder or commit it |
| `GOOGLE_CLIENT_ID` | OAuth client ID dedicated to staging |
| `GOOGLE_CLIENT_SECRET` | Secret belonging to the staging OAuth client |
| `PLATFORM_ADMIN_EMAILS` | Explicit comma-separated allowlist of trusted platform operator email addresses |
| `DATABASE_URL` | Staging PostgreSQL connection string used by the application; use the provider's pooled URL only if supported by its Prisma configuration |
| `DIRECT_URL` | Direct staging PostgreSQL connection string for Prisma migrations |
| `MIDTRANS_SERVER_KEY` | Midtrans Sandbox server key |
| `MIDTRANS_CLIENT_KEY` | Midtrans Sandbox client key |
| `MIDTRANS_IS_PRODUCTION` | `false` |

Do not copy production secrets into Preview. Do not put secrets in GitHub issues, pull-request comments, source files, screenshots, or chat messages. Prefer the hosting provider's encrypted environment-variable interface or an approved secrets manager.

The Marketing application has a separate environment contract in `apps/marketing/.env.example`; do not assume its legacy integrations are configured by the Ops variables above.

## 3. Google OAuth staging client

In Google Cloud Console, create or select a dedicated OAuth 2.0 Web application client for staging.

1. Add the staging origin to **Authorized JavaScript origins**:
   `https://ops-staging.<your-domain>`
2. Add this exact **Authorized redirect URI**:
   `https://ops-staging.<your-domain>/api/auth/callback/google`
3. Store the generated client ID and secret in the Ops Preview environment variables.
4. Set `NEXTAUTH_URL` to the same staging origin.
5. Redeploy the Preview deployment after changing environment variables.

Test with a verified Google account. Confirm successful login, session persistence after refresh, logout, and rejection of an unverified email. Confirm that only the explicitly allowlisted platform operator account receives platform-admin privileges. Do not use a real customer account for the first test.

If the deployment uses a different preview hostname, register that exact origin and callback URI too, or use a stable staging custom domain. Avoid broad wildcard redirect URIs.

## 4. Staging PostgreSQL and migrations

1. Provision a new PostgreSQL database for staging, isolated from production.
2. Restrict network access to the application/migration environment where supported; require TLS.
3. Set `DATABASE_URL` and `DIRECT_URL` to the staging database only.
4. Verify both connection strings target the same staging database and schema.
5. From a controlled environment with the staging variables loaded, run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:generate
   pnpm db:deploy
   ```

6. Verify Prisma reports the expected migrations as applied and inspect the resulting tables, indexes, foreign keys, and tenant-scoped constraints.
7. Run the tenant-integrity SQL check against staging:

   ```bash
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f packages/database/prisma/tests/tenant-integrity.sql
   ```

Do not run `prisma migrate dev` against a shared or production database. Do not reset a staging database containing test evidence without recording the reset and repeating the full test sequence.

## 5. Midtrans Sandbox webhook

In the Midtrans Sandbox dashboard, configure the payment notification URL to:

`https://ops-staging.<your-domain>/api/webhooks/midtrans`

Use Sandbox credentials only and keep `MIDTRANS_IS_PRODUCTION=false`.

Test at minimum:

- Snap checkout can be created for a staging plan and the expected billing cycle.
- A pending payment does not activate the subscription.
- A valid settlement notification activates the intended subscription and extends its license period.
- An accepted capture notification activates only when the fraud status is accepted.
- Invalid signatures are rejected.
- Unknown order IDs, amount mismatch, and non-IDR currency are rejected.
- Duplicate notifications are idempotent.
- A payment transaction reference already associated with another subscription is rejected.
- Expire, deny, and cancel notifications close only eligible incomplete subscriptions and revoke their active licenses.

For every test, record the provider order ID, expected result, observed HTTP status, subscription state, payment state, license state, and relevant audit event. Redact credentials and personal data from evidence.

The current implementation supports a one-time checkout per billing period. Do not describe it as automatic recurring billing or auto-debit.

## 6. Preview smoke and tenant-isolation acceptance

After deploying Ops Preview:

- Confirm `/login` loads over HTTPS.
- Complete Google OAuth login and logout.
- Create a dedicated test organization and verify the creator receives the owner membership.
- Create a second test user with no membership in that organization.
- Verify the second user cannot read the organization's summary, clients, leads, projects, quotations, invoices, expenses, licenses, or subscription data through direct API requests.
- Verify STAFF cannot invoke OWNER/ADMIN-only subscription and license-management operations.
- Verify a user belonging to tenant A cannot read or mutate tenant B records by changing IDs in request paths or bodies.
- Verify successful and rejected Midtrans Sandbox webhook scenarios described above.
- Inspect application logs for secrets, license plaintext, access tokens, and payment credentials; none should be logged.
- Verify the Marketing Preview separately, including the legacy routes and integrations required by Phase 0.

Capture evidence with timestamps and deployment commit SHA. A successful page load alone is not a tenant-isolation acceptance test.

## 7. Rollback and operational safeguards

- Keep the previous known-good Preview deployment available.
- If a deployment fails, stop staging acceptance and redeploy the previous Preview build; do not promote the failed build.
- If a migration fails, preserve logs and database state for diagnosis. Do not manually drop tables or reset the database as a first response.
- Rotate any credential that may have been exposed.
- Never point Preview to production data to work around a staging configuration issue.
- Do not merge PR #6, change the production domain, or promote a deployment as part of this runbook.

## 8. Evidence record

Complete this table before declaring staging acceptance:

| Check | Evidence to record | Status |
|---|---|---|
| Ops Vercel Preview | Deployment URL, commit SHA, build result | Not run |
| Staging environment | Variable names configured; do not record secret values | Not verified |
| Google OAuth | Login, verified email, session, logout | Not run |
| Database migration | Database identifier (non-secret), migration status, SQL check | Not run |
| Midtrans Sandbox | Sandbox order IDs and notification outcomes | Not run |
| Tenant isolation | Test user/tenant matrix and API outcomes | Not run |
| Marketing Preview | URL, commit SHA, route/integration smoke results | Not run |
| Security review | Redacted log review and secret-handling checks | Not run |

## Phase gate

Phase 2 remains **blocked** until staging deployment, Google OAuth, database migration, Midtrans Sandbox notifications, and cross-tenant acceptance tests have been executed and their evidence reviewed. Passing GitHub CI validates the automated repository checks; it does not substitute for these external integration tests.
