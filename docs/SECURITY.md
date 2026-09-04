# Security

_Last updated: stable release (September 2026)._

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

### Token integrity
All token logic is centralized in `lib/actions/token-actions.ts` behind the `TOKENS_ENFORCED` flag. Silent, hard-coded `-1` deductions scattered through the code were removed, so the "free beta" state is now consistent and can be flipped to real enforcement in one place.

## Known deferred items

These were consciously left for a follow-up (the release scope was "critical + high" only). None are exploitable for cross-user data theft because RLS still applies, but they should be tightened before heavy production use:

1. **`model_feedback` RLS is fully permissive.** All four policies use `USING (true)` / `WITH CHECK (true)`, so any authenticated (and, depending on anon policy, unauthenticated) client can read, insert, update, or delete feedback rows. Recommended: restrict `INSERT` to authenticated users and `UPDATE`/`DELETE` to admins; `SELECT` can stay open if feedback is non-sensitive.
2. **Open-redirect hardening on `?redirect=` / `?next=`.** Login/callback should validate that the redirect target is a same-origin relative path before redirecting.
3. **`ignoreBuildErrors` / `ignoreDuringBuilds`** are still enabled in `next.config.mjs`. There is a backlog of pre-existing TypeScript errors (unrelated to this release) that are masked by this. They should be fixed and the flags removed so type regressions fail the build.
4. **Security response headers** (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are not yet configured in `next.config.mjs`.
5. **Rate limiting** on the paid AI routes (per user / per IP) is not implemented; auth is the only gate today.

## Secrets handling

- Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLOUD_API_KEY`, `FAL_KEY`, `BLOB_READ_WRITE_TOKEN`, `STRIPE_SECRET_KEY`. These must never be imported into client components or prefixed with `NEXT_PUBLIC_`.
- Only `NEXT_PUBLIC_*` values (Supabase URL + anon key, site URL) are safe for the browser; the anon key is RLS-scoped by design.

## Reporting

Found a vulnerability? Contact the Allura Homes team directly rather than filing a public issue.
