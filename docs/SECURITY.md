# Security

_Last updated: credits + Stripe billing release (September 2026)._

This document describes the app's trust model, what was hardened for the stable release, and what is deliberately deferred.

## Trust model

- **Identity always comes from the verified session**, never from the request body or query string. Server code resolves the user with Supabase `getUser()` (which validates the token) rather than trusting client-supplied IDs.
- **Row Level Security (RLS) is enabled on every table.** The anon/client key can only read and write rows the policies allow.
- **The service-role key bypasses RLS** and is used only in trusted server code (background job pipeline). Every entry point that uses it performs an explicit ownership/admin check first.
- **Paid AI routes require authentication** so anonymous traffic cannot spend OpenAI/Google credits.
- **Provider error details are never returned to the browser.** They are logged server-side; the client receives a plain-language message and a short error code.

## Hardened in this release

### Authentication on paid / sensitive API routes
`requireUser()` (in `lib/api-auth.ts`) now guards:
`/api/edit-image`, `/api/art-director`, `/api/qa-curator`, `/api/save-variation`, `/api/upload-reference`, `/api/upscale`.
Unauthenticated requests receive `401`. (`/api/import-airbnb` was already guarded.)

### IDOR fixes
- **`/api/save-variation`** previously trusted a `userId` from the request body while using the service-role key — any user could write images into another user's library. It now derives the user from the session, validates the parent image id, enforces a size cap, and checks parent-image ownership.
- **`getUserImages`** ignores a mismatched client-supplied `userId` and always uses the session user.

### Ownership checks on service-role mutations
`updateFileApproval` and `generateFinalImages` (`lib/actions/job-actions.ts`) now call a shared `assertJobOwner()` (owner or admin) before mutating a job. `GET /api/jobs/[jobId]` scopes to the owner (admins may view any).

### Removed attack surface
- Deleted the unused legacy `createJob` server action, which inserted jobs via the service-role key with no `user_id` and no ownership.
- **`/api/upload-reference`** now requires auth, derives the file extension from the validated MIME type (not the user-supplied filename), and writes to a per-user path.

### Reduced information disclosure
`edit-image`, `save-variation`, and `qa-curator` no longer echo raw provider error text (which could include quota/key hints). Failures are classified into friendly messages with codes (`RATE_LIMITED`, `TIMEOUT`, `CONTENT_BLOCKED`, `MODEL_UNAVAILABLE`, …).

### Credit integrity (billing release)
- Every balance change goes through the `spend_credits()` Postgres function, which takes a row lock, checks the balance and writes the ledger row in one transaction. Two concurrent spends cannot overdraw; the server never trusts a client-supplied balance or cost.
- Costs are read from `lib/plans.ts` on the server. Model access is enforced server-side in `/api/edit-image` (`planAllowsModel`), not just hidden in the UI.
- `past_due` subscriptions are blocked from spending until the invoice is paid.

### Stripe webhook
- `POST /api/stripe/webhook` verifies the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET` before parsing; a bad signature returns `400`.
- Event ids are recorded in `stripe_events` before processing, so a replayed event is acknowledged and ignored (no double grants).
- User identity comes from `metadata.supabase_user_id` / the stored `stripe_customer_id`, never from the request body.
- Checkout Sessions are created server-side with server-chosen Prices (resolved by lookup key); the client only sends a plan or pack id, which is validated against `lib/plans.ts`.

### Open-redirect hardening
`?redirect=` (login, sign-up) and `?next=` (auth callback) are passed through `lib/safe-redirect.ts`, which accepts only same-origin absolute paths (rejects `//host`, schemes, control characters and `/auth/*` loops). This closes deferred item 2 from the stable release.

### Admin credit adjustments
`adminAdjustCredits` (`lib/actions/admin-billing-actions.ts`) re-checks `role = 'admin'` from the session, caps the delta, requires a reason, and records the acting admin in the ledger description.

## Known deferred items

These were consciously left for a follow-up (the release scope was "critical + high" only). None are exploitable for cross-user data theft because RLS still applies, but they should be tightened before heavy production use:

1. **`model_feedback` RLS is fully permissive.** All four policies use `USING (true)` / `WITH CHECK (true)`, so any authenticated (and, depending on anon policy, unauthenticated) client can read, insert, update, or delete feedback rows. Recommended: restrict `INSERT` to authenticated users and `UPDATE`/`DELETE` to admins; `SELECT` can stay open if feedback is non-sensitive.
2. ~~Open-redirect hardening on `?redirect=` / `?next=`.~~ **Closed** in the billing release (`lib/safe-redirect.ts`).
3. **`ignoreBuildErrors` / `ignoreDuringBuilds`** are still enabled in `next.config.mjs`. There is a backlog of pre-existing TypeScript errors (unrelated to this release) that are masked by this. They should be fixed and the flags removed so type regressions fail the build.
4. **Security response headers** (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are not yet configured in `next.config.mjs`.
5. **Rate limiting** on the paid AI routes (per user / per IP) is not implemented; auth is the only gate today.

## Secrets handling

- Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLOUD_API_KEY`, `FAL_KEY`, `BLOB_READ_WRITE_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`. These must never be imported into client components or prefixed with `NEXT_PUBLIC_`.
- Only `NEXT_PUBLIC_*` values (Supabase URL + anon key, site URL, Stripe publishable key) are safe for the browser; the anon key is RLS-scoped by design.

## Reporting

Found a vulnerability? Contact the Allura Homes team directly rather than filing a public issue.
