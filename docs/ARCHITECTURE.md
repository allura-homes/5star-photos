# Architecture

_Last updated: stable release (September 2026)._

## Overview

5star.photos is a Next.js (App Router) app backed by Supabase. All user data lives in Postgres with Row Level Security (RLS) enabled on every table. AI model calls happen server-side in route handlers; token/ownership logic lives in server actions.

There is **one** primary user pipeline:

```
Library ──▶ Upload photo ──▶ open photo ──▶ Transform ──▶ compare variations ──▶ save / download hi-res
```

A second, older **job-based** pipeline (Quick Enhance → Batch Jobs → Preview → Download) has been retired for regular users and is now **admin-only** (kept for support/debugging). Middleware redirects non-admins away from it.

---

## Routes

### User-facing (require auth)
| Route | Purpose |
|---|---|
| `/library` | Home. Photo grid, uploader, first-run guide. `?upload=1` deep-links to the uploader. |
| `/transform/[imageId]` | Run models on one photo, compare, save variations. |
| `/batch-transform` | Enhance many photos at once. |
| `/library/projects/[projectId]` | Photos grouped into a project. |
| `/history` | Activity / credit ledger history. |
| `/account` | Profile, plan and credit balance, upgrade / top-up / manage billing, ledger, sign out. |
| `/checkout?plan=&interval=` / `?pack=` | Embedded Stripe Checkout. `/checkout/return` polls the balance until the webhook lands. |
| `/help` | In-app user guide (replaces the old `/about`). |

### Public
| Route | Purpose |
|---|---|
| `/` | Marketing landing page. |
| `/pricing` | Plan cards (monthly/annual), top-up packs, credit cost table. |
| `/enhance` | Guest upload landing (signed-in users are redirected to `/library`). |
| `/privacy`, `/terms` | Legal pages. |
| `/auth/login`, `/auth/signup`, `/auth/callback` | Supabase auth. |

### Admin-only (role = `admin`)
| Route | Purpose |
|---|---|
| `/admin` | Admin dashboard. |
| `/admin/training` | Model feedback review / exemplary tagging. |
| `/batch-jobs`, `/preview/[jobId]`, `/download/[jobId]` | Legacy job pipeline. |

### API route handlers
| Route | Auth | Purpose |
|---|---|---|
| `POST /api/edit-image` | required | Runs one image model. **Spends paid credits.** |
| `POST /api/art-director` | required | Generates the enhancement prompt for a photo. |
| `POST /api/qa-curator` | required | AI QA check on a generated image. |
| `POST /api/save-variation` | required | Persists a generated variation (user derived from session). |
| `POST /api/upload-reference` | required | Uploads a reference image to Blob, scoped to the user. |
| `POST /api/upscale` | required | (Deprecated) fal.ai upscaling. |
| `POST /api/import-airbnb` | required | Imports listing photos from an Airbnb URL. |
| `GET /api/jobs/[jobId]` | required | Job status (scoped to owner; admins see any). |
| `POST /api/stripe/webhook` | Stripe signature | Syncs subscriptions and grants credits. Idempotent via `stripe_events`. |
| `GET /api/cron/grant-annual-credits` | `CRON_SECRET` | Daily reset of `plan_credits` for annual subscribers. |

---

## Navigation shell

`components/app-shell.tsx` wraps every authenticated page and renders:
- `components/header.tsx` — logo, account menu (mobile-friendly).
- `components/sidebar.tsx` — desktop left rail (icons: Library, Upload, Batch Enhance, Activity, Help; Admin/Training shown only to admins).
- `components/mobile-nav.tsx` — fixed bottom bar on small screens.
- `components/user-menu.tsx` — credits pill (turns red when below one transform) and plan badge; links to `/pricing` or `/account`.
- `components/beta-banner.tsx` — legacy "free beta" notice; permanently hidden now that credits are enforced.

The old per-page `Header + Sidebar` markup was consolidated into `AppShell` so every page shares one responsive layout.

---

## Data model (Postgres / Supabase)

All tables have RLS enabled.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (=auth uid), `role`, `display_name`, `plan`, `billing_interval`, `plan_credits`, `topup_credits`, `tokens` (trigger-maintained usable balance), `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end` | `role = 'admin'` unlocks admin routes. Balance changes go through the `spend_credits()` function. |
| `stripe_events` | `id` (Stripe event id), `type`, `received_at` | Webhook idempotency. |
| `images` | `id`, `user_id`, `original_filename`, `storage_path`, `parent_image_id`, `source_model` | Uploaded photos and saved variations (variations reference a parent). |
| `projects` | `id`, `user_id` | Groups of images. |
| `jobs` | `id`, `user_id`, `status`, `file_list` | Legacy job pipeline. |
| `token_transactions` | `user_id`, `type`, `amount`, `balance_after`, `description`, `image_id`, `job_id`, `file_name` | Credit ledger; every debit, grant and refund. |
| `model_feedback` | `model_provider`, `feedback_type`, image refs | Thumbs up/down used by `/admin/training`. |
| `comparison_votes`, `shared_comparisons` | — | Public comparison sharing/voting. |

`type` allowed values on `token_transactions`: `upload, transform, save_variation, download_hires, upscale, refund, welcome_grant, plan_grant, period_reset, topup_purchase, admin_adjust` plus legacy `purchase, revision, bonus`. See [BILLING.md](BILLING.md).

---

## The enhancement pipeline

1. **Upload** (`lib/actions/image-actions.ts → uploadImage`): image is compressed client-side (`lib/compress-image.ts`), 1 credit is charged via `chargeForAction`, the file is stored in Supabase Storage, and a row is written to `images`.
2. **Art Director** (`POST /api/art-director`): analyzes the photo and returns a conditional enhancement prompt (see [ART_DIRECTOR_STRATEGY.md](ART_DIRECTOR_STRATEGY.md)).
3. **Transform** (`app/transform/[imageId]`): calls `POST /api/edit-image` once per model the user's plan allows (`planAllowsModel`) **in parallel**. The first call charges 10 credits for the whole transform; if every model fails the charge is refunded. Models outside the plan render as locked cards linking to `/pricing`. Per-model failures are isolated and shown in plain language, never as raw provider errors.
4. **Save** (`POST /api/save-variation`): charges 1 credit and writes the chosen variation to `images` with `parent_image_id` set.
5. **Download hi-res** (`image-actions.ts → generateSignedDownloadUrl` path): charges 3 credits and returns a signed URL.

Any `INSUFFICIENT_CREDITS` / `PAST_DUE` response opens the shared `InsufficientCreditsDialog` (`components/billing/insufficient-credits-dialog.tsx`), which shows cost vs. balance and the next plan up.

Model IDs and the provider→model mapping are centralized in `lib/constants/models.ts` and documented in [MODEL_CONFIGURATION.md](../MODEL_CONFIGURATION.md). Active models: **V1** (`openai`/gpt-image-1), **V2** (`nano_banana_pro`/gemini-3-pro-image-preview), **V4** (`openai_2`/gpt-image-2, kept enabled by product decision; may be unavailable depending on OpenAI org verification).

---

## Auth flow

- Supabase Auth with email + password (a "Continue with Google" option is also present).
- Server helpers: `lib/supabase/server.ts` (RLS-scoped, cookie-based), `lib/supabase/proxy.ts` (middleware session refresh + route protection), `lib/api-auth.ts` (`requireUser()` guard for route handlers).
- `middleware.ts` runs `proxy.ts` on every request: refreshes the session, protects `/library`, `/account`, `/history`, `/transform`, `/batch-transform`, `/checkout`, gates `/admin/*` and the legacy pages to admins, and redirects `/about → /help` and signed-in `/enhance → /library`. The login redirect keeps the query string so `/checkout?plan=pro` survives the round-trip.
- `?redirect=` / `?next=` values are validated by `lib/safe-redirect.ts` (same-origin absolute paths only) on the login, sign-up and callback pages.
- Known Supabase-auth gotcha (login spinning after long inactivity) and its fix are tracked in the team's auth notes.

---

## Configuration flags

| Flag | Location | Effect |
|---|---|---|
| `TOKENS_ENFORCED` | `lib/constants/tokens.ts` | Always `true` since the credits release; kept only so legacy readers compile. Credit costs live in `lib/plans.ts → CREDIT_COSTS`. |
| `PLANS`, `TOPUP_PACKS`, `CREDIT_COSTS` | `lib/plans.ts` | Single source of truth for prices, monthly credits, model access and per-action costs. |
| `ACTIVE_MODELS` | `lib/constants/models.ts` | Which model variations run and are shown to users. |
