# Authentication migration: NextAuth v4 to Better Auth

Status: proposed implementation plan for the Cloudflare Workers Preview path.

## Decision

Replace NextAuth v4 in the Ops application with Better Auth before adopting vinext. The vinext compatibility report for the Ops application returned 93% overall compatibility and identified `next-auth` as the sole library issue because it relies on Next.js API route internals.

Better Auth is selected because it provides a first-party Google OAuth provider, a Next.js App Router handler, a React client, and a Prisma adapter. Keep the existing Next.js application and Vercel deployment path working while the Cloudflare path is validated.

References:
- Cloudflare vinext guidance: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Better Auth Google OAuth: https://better-auth.com/docs/authentication/google
- Better Auth Prisma adapter: https://better-auth.com/docs/adapters/prisma
- Better Auth OAuth validation and account linking: https://better-auth.com/docs/concepts/oauth

## Compatibility and data-preservation constraints

- Preserve the existing `User.id` values. Membership, audit, licensing, and document ownership records reference these IDs.
- Preserve the existing `User.email`, `name`, and `isPlatformAdmin` data.
- Existing users were provisioned only after NextAuth's Google sign-in callback confirmed `email_verified === true`. A Preview-only migration may backfill `emailVerified = true` for these existing users, while new users must be verified by Google's trusted profile.
- Enable Google account linking only for the trusted Google provider and require verified email. Confirm the behavior against existing Preview users before accepting the migration.
- Keep platform-admin authorization server-side and recompute the allowlist policy; never accept an admin flag from the browser.
- Keep the current eight-hour session lifetime unless security testing identifies a blocker.
- Existing NextAuth JWT cookies are not portable to Better Auth. Users will need to authenticate again after the Preview cutover. This is an expected one-time reauthentication, not a deletion of user or tenant data.
- Do not change Production OAuth credentials, Production database, DNS, or live traffic.

## Planned implementation

1. Add Better Auth core and its Prisma adapter using compatible pinned versions.
2. Extend the existing Prisma schema with Better Auth session, account, and verification models and required user fields, preserving the current User model and all existing relations.
3. Implement Google OAuth with verified-email enforcement, trusted-provider account linking, and server-side platform-admin allowlist handling.
4. Add the Better Auth catch-all route and replace server/client NextAuth session access with Better Auth APIs.
5. Keep the login URL and Indonesian login experience; keep sign-out returning to `/login`.
6. Generate and review a Preview-only Prisma migration. Never run schema migration from Worker runtime.
7. Run unit tests and typecheck, then verify OAuth, session expiry, refresh, sign-out, existing-user account linking, organization membership, and tenant-isolation tests.
8. Only after the authentication branch is validated, proceed with vinext initialization and Cloudflare Workers Preview wiring.

## Acceptance gates

- Existing Preview user IDs and organization memberships remain unchanged.
- Existing Google users can sign in and are linked to their existing user records; no duplicate user rows.
- Unverified Google email cannot obtain a session.
- Platform-admin allowlist is enforced server-side and revocation takes effect without trusting stale client state.
- Unauthenticated requests return the existing 401/redirect behavior; non-members continue receiving 403.
- Google OAuth callback, session retrieval, refresh, and sign-out work on both local Next.js and Cloudflare Workers Preview.
- Existing Vercel deployment path remains available as fallback.
- No Production resources or traffic are modified.
