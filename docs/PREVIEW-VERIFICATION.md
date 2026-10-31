# Phase 2 Preview Verification Runbook

## Purpose

Verify the Phase 2 Ops application against a dedicated Vercel Preview deployment before invoice/payment reconciliation, security review, or release-candidate sign-off. This runbook does not authorize a production deployment or a merge.

## Current verification snapshot

| Gate | Result | Evidence / blocker |
|---|---|---|
| GitHub CI for Phase 2 head | PASS | Run #41166368300 passed on `5b431f612325a8e4bb37b23beede1ae10b6df3b3`. |
| Vercel Preview for Phase 2 head | BLOCKED | Latest deployment for this branch/SHA was canceled with Vercel's `skipping-unaffected-projects` explanation. No READY Preview URL exists for this SHA. |
| Dedicated Ops Vercel project | REQUIRED | Repository deployment guidance requires separate projects for `apps/marketing` and `apps/ops`. Do not repurpose the existing `dzarozaproperty` project or its production domains for Ops. |
| Preview database | NOT VERIFIED | A dedicated non-production PostgreSQL database and its `DATABASE_URL` / `DIRECT_URL` must be configured and migrations applied. |
| Provider sandbox | NOT VERIFIED | Midtrans sandbox and Resend credentials must be configured in Preview before external payment/email flows can be exercised. |

The canceled Vercel deployment is not a failed application build and is not evidence that the application works in Preview. The GitHub CI result is also not a substitute for a deployed Preview smoke test.

## Dedicated Vercel project configuration

Create or select a dedicated non-production Vercel project for Ops (suggested project name: `dzaroza-ops-preview`) linked to `kholilmuflikhun/dzarozaproperty`.

- Root Directory: `apps/ops`.
- Framework: Next.js.
- Node.js: 22.x or 24.x (repository engine range is `>=22 <25`).
- Package manager: pnpm 10.18.0, using the repository-root `pnpm-lock.yaml`.
- Enable access to workspace files outside the root directory / monorepo source files.
- Install command: `pnpm install --frozen-lockfile` from the repository root.
- Build command: `pnpm --filter @dzaroza/ops build`.
- Preview deployments only; do not assign production domains or change the production project.
- Ensure the deployment is tied to the exact Phase 2 branch and commit SHA.

Do not create a new Vercel project or change project settings as part of this runbook without explicit project-owner approval.

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
