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
| `/history` | Activity / token transaction history. |
| `/account` | Profile, usage stats, token history, sign out. |
| `/help` | In-app user guide (replaces the old `/about`). |

### Public
| Route | Purpose |
|---|---|
| `/` | Marketing landing page. |
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

---

## Navigation shell

`components/app-shell.tsx` wraps every authenticated page and renders:
- `components/header.tsx` — logo, account menu (mobile-friendly).
- `components/sidebar.tsx` — desktop left rail (icons: Library, Upload, Batch Enhance, Activity, Help; Admin/Training shown only to admins).
- `components/mobile-nav.tsx` — fixed bottom bar on small screens.
- `components/beta-banner.tsx` — dismissible "free beta" notice (hidden when tokens are enforced).

The old per-page `Header + Sidebar` markup was consolidated into `AppShell` so every page shares one responsive layout.

---

## Data model (Postgres / Supabase)

All tables have RLS enabled.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (=auth uid), `role`, `tokens`, `display_name` | `role = 'admin'` unlocks admin routes. |
| `images` | `id`, `user_id`, `original_filename`, `storage_path`, `parent_image_id`, `source_model` | Uploaded photos and saved variations (variations reference a parent). |
| `projects` | `id`, `user_id` | Groups of images. |
| `jobs` | `id`, `user_id`, `status`, `file_list` | Legacy job pipeline. |
| `token_transactions` | `user_id`, `type`, `amount`, `description`, `image_id`, `job_id`, `file_name` | Usage log. `amount = 0` during free beta. |
| `model_feedback` | `model_provider`, `feedback_type`, image refs | Thumbs up/down used by `/admin/training`. |
| `comparison_votes`, `shared_comparisons` | — | Public comparison sharing/voting. |

`type` allowed values on `token_transactions`: `purchase, revision, upscale, bonus, refund, upload, transform, save_variation, download_hires`.

---

## The enhancement pipeline

1. **Upload** (`lib/actions/image-actions.ts → uploadImage`): image is compressed client-side (`lib/compress-image.ts`), stored in Supabase Storage, and a row is written to `images`. A usage row is logged via `deductTokensForUpload`.
2. **Art Director** (`POST /api/art-director`): analyzes the photo and returns a conditional enhancement prompt (see [ART_DIRECTOR_STRATEGY.md](ART_DIRECTOR_STRATEGY.md)).
3. **Transform** (`app/transform/[imageId]`): calls `POST /api/edit-image` once per active model **in parallel**. Each result is shown as a variation; per-model failures are isolated and shown in plain language, never as raw provider errors.
4. **Save** (`POST /api/save-variation`): the chosen variation is written to `images` with `parent_image_id` set.
5. **Download hi-res** (`image-actions.ts → generateSignedDownloadUrl` path): logs a `download_hires` usage row and returns a signed URL.

Model IDs and the provider→model mapping are centralized in `lib/constants/models.ts` and documented in [MODEL_CONFIGURATION.md](../MODEL_CONFIGURATION.md). Active models: **V1** (`openai`/gpt-image-1), **V2** (`nano_banana_pro`/gemini-3-pro-image-preview), **V4** (`openai_2`/gpt-image-2, kept enabled by product decision; may be unavailable depending on OpenAI org verification).

---

## Auth flow

- Supabase Auth with email + password (a "Continue with Google" option is also present).
- Server helpers: `lib/supabase/server.ts` (RLS-scoped, cookie-based), `lib/supabase/proxy.ts` (middleware session refresh + route protection), `lib/api-auth.ts` (`requireUser()` guard for route handlers).
- `middleware.ts` runs `proxy.ts` on every request: refreshes the session, protects `/library`, `/account`, `/history`, `/transform`, `/batch-transform`, gates `/admin/*` and the legacy pages to admins, and redirects `/about → /help` and signed-in `/enhance → /library`.
- Known Supabase-auth gotcha (login spinning after long inactivity) and its fix are tracked in the team's auth notes.

---

## Configuration flags

| Flag | Location | Effect |
|---|---|---|
| `TOKENS_ENFORCED` | `lib/constants/tokens.ts` (env: `NEXT_PUBLIC_TOKENS_ENFORCED`) | When `false` (default), all actions are free and the beta banner shows. When `true`, token balances are checked and deducted. |
| `ACTIVE_MODELS` | `lib/constants/models.ts` | Which model variations run and are shown to users. |
