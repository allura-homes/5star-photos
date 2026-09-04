# 5star.photos

AI photo enhancement for short-term-rental (STR) hosts. Upload a listing photo, and the app runs it through multiple image models in parallel, lets you compare the results side by side, and download the one that will make the listing book.

Built by Allura Homes.

---

## What it does

- **Upload** interior or exterior listing photos (drag & drop, Airbnb import, or batch).
- **Enhance** each photo with several AI models at once ("variations"), driven by an AI "Art Director" that writes a per-photo enhancement prompt.
- **Compare** the original and every variation side by side and save the best.
- **Download** a high-resolution version for the listing.

The whole first result takes about a minute. New users can click **Try a sample photo** on an empty library to see the flow end to end without finding their own photo first.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript + React |
| Styling | Tailwind CSS |
| Auth & DB | Supabase (Postgres + Auth + Storage, RLS enforced) |
| File storage | Supabase Storage + Vercel Blob (reference images) |
| AI models | OpenAI Images Edits (`gpt-image-1`), Google `gemini-3-pro-image-preview` ("Nano Banana Pro"), plus optional variants |
| Notifications | `sonner` toasts |
| Hosting | Vercel |

---

## Getting started

```bash
pnpm install
pnpm dev
```

The app reads its configuration from environment variables (see below). In v0 / Vercel these are injected automatically for connected integrations.

### Required environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client, RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key for background pipeline work |
| `OPENAI_API_KEY` | OpenAI Images Edits API |
| `GOOGLE_CLOUD_API_KEY` | Google Generative Language API (Nano Banana Pro) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (reference-image uploads) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for auth redirects |

Optional: `FAL_KEY` (deprecated fal.ai upscaling/FLUX), `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` (v0 preview auth redirect proxy).

> **Never** expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `GOOGLE_CLOUD_API_KEY` to the client. They are used only in server actions and route handlers.

---

## Documentation

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Routes, data model, the enhancement pipeline, auth flow |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust model, what's hardened, and known deferred items |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End-user walkthrough (also surfaced in-app at `/help`) |
| [MODEL_CONFIGURATION.md](MODEL_CONFIGURATION.md) | Exact AI model IDs, endpoints, and provider mapping |
| [docs/ART_DIRECTOR_STRATEGY.md](docs/ART_DIRECTOR_STRATEGY.md) | How enhancement prompts are generated |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Billing / tokens

The app has a token system (upload / transform / hi-res download cost tokens). It is currently in **free beta**: enforcement is turned off via a single flag (`TOKENS_ENFORCED` in `lib/constants/tokens.ts`) and every action is free. Usage is still recorded in `token_transactions` so history and a future paid tier work without a rewrite. Flip the flag to `true` (or set `NEXT_PUBLIC_TOKENS_ENFORCED=true`) to enable charging.

---

## Project layout

```
app/            App Router routes (see docs/ARCHITECTURE.md)
components/     UI: AppShell, sidebar, mobile nav, library, transform UI
lib/actions/    Server actions (auth, images, jobs, tokens, account)
lib/constants/  Model + token configuration (single source of truth)
lib/supabase/   Supabase server/client/proxy helpers
docs/           Architecture, security, user guide, model strategy
```
