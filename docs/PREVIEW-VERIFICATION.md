# Phase 2 Preview Verification Runbook

## Purpose

Verify the Phase 2 Ops application against a dedicated Vercel Preview deployment before invoice/payment reconciliation, security review, or release-candidate sign-off. This runbook does not authorize a production deployment or a merge.

## Current verification snapshot

| Gate | Result | Evidence / blocker |
|---|---|---|
| GitHub CI for Phase 2 head | PASS | Run #41166368300 passed on `5b431f612325a8e4bb37b23beede1ae10b6df3b3`. |
| Vercel Preview for Phase 2 head | BLOCKED | Latest deployment for this branch/SHA was canceled with Vercel's `skipping-unaffected-projects` explanation. No READY Preview URL exists for this SHA. |
| Dedicated Ops Vercel project | CREATED / CONFIGURED | `dzaroza-ops-preview` (`prj_7HKMftXhAyBkVuKlc2qKtmKQoxbv`) is linked to the repository, configured for Next.js / Node 24, workspace install/build commands, and Preview-only SSO protection. No deployment was triggered. |
| Preview database | BLOCKED | Neon connection is pending. A dedicated non-production PostgreSQL branch/database and its `DATABASE_URL` / `DIRECT_URL` still need to be provisioned and added to Preview. |
| Provider sandbox | PARTIALLY PREPARED | `MIDTRANS_IS_PRODUCTION=false` has been set for Preview on `feat/phase-2-business-finance-workflows`. Sandbox keys, OAuth credentials, and Resend credentials are not yet configured. |

The canceled Vercel deployment is not a failed application build and is not evidence that the application works in Preview. The GitHub CI result is also not a substitute for a deployed Preview smoke test.

## Dedicated Vercel project configuration

The dedicated non-production Vercel project `dzaroza-ops-preview` has been created and linked to `kholilmuflikhun/dzarozaproperty`. Project ID: `prj_7HKMftXhAyBkVuKlc2qKtmKQoxbv`.

- Root Directory: `apps/ops`.
- Framework: Next.js.
- Node.js: 22.x or 24.x (repository engine range is `>=22 <25`).
- Package manager: pnpm 10.18.0, using the repository-root `pnpm-lock.yaml`.
- Enable access to workspace files outside the root directory / monorepo source files.
- Install command: `pnpm install --frozen-lockfile` from the repository root.
- Build command: `pnpm --filter @dzaroza/ops build`.
- Preview deployments remain enabled; no production domain is assigned. Preview deployment protection is set to Vercel Authentication (SSO).
- Project uses Node 24.x. Workspace install and Ops build commands were configured.
- `enableAffectedProjectsDeployments` was disabled for this project to avoid silently skipping Ops deployments when Vercel judges a root-level change as unaffected.
- Project creation was performed link-only; no deployment was triggered. The actual root-directory value was submitted as `apps/ops` but is not echoed by the project-read response, so verify it in Vercel Project Settings before deploying.
- Ensure the eventual deployment is tied to the exact Phase 2 branch and commit SHA.

Do not add production domains or modify the existing `dzarozaproperty` project.

## Preview environment variables

Configure values in Vercel's Preview environment only. Never commit credentials or include their values in issue/PR comments.

Required application/database configuration:
- `DATABASE_URL`: dedicated Preview PostgreSQL connection string.
- `DIRECT_URL`: direct connection string used by Prisma migrations where applicable.
- `NEXTAUTH_URL`: exact Ops Preview origin.
- `NEXTAUTH_SECRET`: strong, unique Preview secret.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: OAuth client configured with the Preview callback `/api/auth/callback/google`.
- `PLATFORM_ADMIN_EMAILS`: explicit allowlist for platform administration; never accept this from browser input.

Phase 2 integrations:
- `MIDTRANS_IS_PRODUCTION=false` is already configured in Preview, scoped to branch `feat/phase-2-business-finance-workflows`.
- `MIDTRANS_SERVER_KEY`: Midtrans sandbox server key.
- `MIDTRANS_CLIENT_KEY` and `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`: matching sandbox client key if both are used by the app.
- `MIDTRANS_IS_PRODUCTION=false` and `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false`.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: test sender/domain configuration. If not configured, email delivery must be treated as unavailable and manual approval-link fallback tested.

Do not copy production database credentials, production payment keys, or production email credentials into Preview. Verify the configured key names and target environment without printing secret values.

## Verification sequence

### A. Deployment and availability
- [ ] Vercel deployment is `READY`, target is Preview, branch and commit SHA match the intended Phase 2 head.
- [ ] Preview URL is protected from public indexing and has no production domain alias.
- [ ] Public route responds successfully.
- [ ] Ops login route renders successfully.
- [ ] OAuth callback URI matches the Preview host and login completes using a test account.
- [ ] Authenticated user can access only organizations for which server-side membership exists.

### B. Quotation approval
- [ ] Create and issue a test quotation.
- [ ] Generate an approval link and confirm it opens `/approval/[token]`.
- [ ] Verify quotation snapshot, accept/reject controls and no-index response metadata.
- [ ] Accept once; verify replay is rejected and project conversion is idempotent.
- [ ] Repeat with a separate quotation and reject once.
- [ ] Verify expired and rotated tokens cannot be used.
- [ ] Verify rate-limit responses without exposing token material in logs.
- [ ] Test Resend delivery if configured; otherwise verify the explicit manual-link fallback.

### C. Invoice and PDF
- [ ] Create a manual invoice and an invoice from an accepted quotation.
- [ ] Confirm server-calculated line totals, discount/tax values and final total.
- [ ] Issue invoice; verify draft/void lifecycle restrictions.
- [ ] Download a multi-page PDF and inspect totals, paid amount and outstanding balance.
- [ ] Test email delivery to a controlled test mailbox if Resend is configured.
- [ ] Confirm duplicate invoice-from-quotation requests do not create a second invoice.

### D. Payment and financial dashboard
- [ ] Record a partial manual settlement; verify remaining balance.
- [ ] Record final settlement; verify invoice status and settled collections.
- [ ] Confirm overpayment and payments against draft/void/paid invoices are rejected.
- [ ] Create a Midtrans sandbox checkout and complete a sandbox payment.
- [ ] Deliver the signed webhook; verify amount matching, event deduplication and no double settlement on replay.
- [ ] Verify finance totals and six-month trend against the seeded test invoices, payments and expenses.
- [ ] Confirm tenant A cannot access tenant B's quotations, invoices, payments, PDFs or finance summary.

### E. Evidence and exit criteria
- [ ] Record Preview URL, deployment ID, branch, full SHA, timestamp and operator.
- [ ] Record test outcomes and sanitized request/response identifiers; never record bearer tokens or secrets.
- [ ] Attach screenshots/log references for failed or blocked checks.
- [ ] Keep the PR in Draft until all required checks pass and dependencies are reviewed in order.

## Stop conditions

Stop Preview sign-off if the deployment is canceled, the commit SHA does not match, the Preview database is shared with production, OAuth callback is misconfigured, production credentials/domains are involved, tenant isolation fails, webhook signature/amount validation fails, or any bearer token/secret appears in logs.

## Dependency and release policy

- PR #8 must be reviewed and resolved first.
- PR #9 must then be reviewed and resolved against the approved PR #8 base.
- PR #10 remains Draft and unmerged until both dependencies are reviewed and the stack is retargeted/rebased as needed.
- No merge to `main`, production deployment, production domain change, or production credential change is authorized by this runbook.


## Execution update — 2026-10-31

### Vercel project prepared
- Created dedicated project `dzaroza-ops-preview`, ID `prj_7HKMftXhAyBkVuKlc2qKtmKQoxbv`, in the existing Vercel team.
- Linked repository `kholilmuflikhun/dzarozaproperty`.
- Submitted root directory `apps/ops`; confirm this exact value in Project Settings because the normalized project-read response does not expose it.
- Configured Next.js, Node 24.x, `pnpm install --frozen-lockfile`, `pnpm --filter @dzaroza/ops build`, workspace files outside root, Preview deployments enabled, affected-project skipping disabled, and Vercel Authentication for Preview.
- No deployment was triggered. No production domain was attached and the existing production project was not changed.
- Set `MIDTRANS_IS_PRODUCTION=false` as a Preview-only variable for branch `feat/phase-2-business-finance-workflows`.

### Remaining actions requiring connected provider/account credentials
1. Connect the Neon service to provision an isolated PostgreSQL Preview branch/database. Add its pooled `DATABASE_URL` and direct `DIRECT_URL` to the Vercel Preview environment. Do not reuse production data.
2. Create a Google OAuth client for the eventual Ops Preview hostname and add `https://<preview-host>/api/auth/callback/google` as an authorized redirect URI. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `PLATFORM_ADMIN_EMAILS` to Preview only.
3. Add Midtrans Sandbox `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and matching public client configuration if required by the client code. Keep production mode false.
4. Add Resend test `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; otherwise explicitly test the manual approval-link fallback and the invoice-email unavailable response.
5. After database and minimum auth variables are present, deploy the exact Phase 2 branch as Preview, confirm the deployment is READY and run the verification checklist above.

Secrets must be entered through the provider's secure settings, never committed to Git or pasted into PR comments/chat. Do not start Preview acceptance tests until the dedicated database and OAuth callback are configured.
