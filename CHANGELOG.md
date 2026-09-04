# Changelog

All notable changes to the 5star.photos app will be documented in this file.

## [Stable Release] - 2026-09-04

### Summary
Product-hardening release that turns the app into a single, coherent, secure product: one clear user workflow, a shared responsive navigation shell, real onboarding, and a locked-down API surface. Also adds full project documentation.

### Security
- Added authentication (`requireUser()`) to all paid/sensitive API routes: `edit-image`, `art-director`, `qa-curator`, `save-variation`, `upload-reference`, `upscale` (previously unauthenticated).
- Fixed an IDOR in `save-variation` (trusted a body `userId` while using the service-role key) — user is now derived from the session, with parent-image ownership and size validation.
- `getUserImages` ignores mismatched client `userId` and uses the session user.
- Added shared `assertJobOwner()` ownership checks to job mutations and `GET /api/jobs/[jobId]`.
- Removed the unused legacy `createJob` action (service-role insert with no ownership).
- `upload-reference` now derives the file extension from the validated MIME type and writes to a per-user path.
- Stopped leaking raw provider error text to the client; errors are classified into friendly messages with codes.
- See [docs/SECURITY.md](docs/SECURITY.md) for the trust model and known deferred items (notably `model_feedback` RLS, redirect validation, and re-enabling type checking in the build).

### Product & UX
- New responsive `AppShell` (header + desktop sidebar + mobile bottom nav + beta banner) shared across all authenticated pages.
- Consolidated to one primary workflow (Library → Transform → compare → download); retired the legacy job pipeline to admin-only, with middleware redirects.
- Added a first-run guide and **Try a sample photo** onboarding on the empty library.
- Replaced all blocking `alert()` calls with `sonner` toasts (lifted above the mobile bottom nav).
- Added `/help`, `/account`, `/privacy`, and `/terms`; redirected `/about → /help`.
- Centralized token logic behind a single `TOKENS_ENFORCED` flag ("free beta" = all actions free but still logged); removed scattered hard-coded token deductions.

### Fixes
- Sample-photo and large-photo uploads no longer fail the Server Action body limit (raised limit + shared client-side compressor in `lib/compress-image.ts`).
- Expanded the `token_transactions.type` CHECK constraint to include `upload`, `transform`, `save_variation`, and `download_hires` so usage logging succeeds.

### Documentation
- Added `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/USER_GUIDE.md`.

## [v197] - 2025-12-03 - STABLE CHECKPOINT

### Summary
This version represents a stable checkpoint after significant improvements to the AI image enhancement pipeline. Both V1 (OpenAI) and V2 (Nano Banana Pro) are producing good results with proper color preservation and structural integrity.

### Active Models
- **V1 - OpenAI gpt-image-1**: High-quality image editing via Images Edits API (1536x1024 landscape)
- **V2 - Nano Banana Pro (gemini-3-pro-image-preview)**: Best color accuracy, photorealistic results

### Key Accomplishments
- Deprecated Gemini Flash (V2) due to poor color accuracy (changed house colors)
- Fixed OpenAI API from using Responses API to proper Images Edits API
- Implemented 4:3 landscape aspect ratio (1536x1024) for all outputs
- Added comprehensive Art Director strategy with conditional enhancement rules
- Fixed filename sanitization for Supabase storage (spaces in filenames)
- Reduced V2 max image size to 2MB for reliable API calls
- Fixed error handling for non-JSON error responses

### Art Director Improvements
- Implemented "Golden Rule: Describe Only What You See" to prevent hallucinated elements
- Added conditional enhancement rules (only describe elements that exist)
- Added photorealism requirements to prevent cartoonish/over-saturated outputs
- Added structural preservation rules for driveways, fences, and background elements
- Comprehensive documentation in docs/ART_DIRECTOR_STRATEGY.md

### Known Behaviors
- V1 (OpenAI): Tends to make more dramatic enhancements, occasionally looks slightly stylized
- V2 (Nano Banana Pro): More conservative, better color preservation, very photorealistic
- Both models respect driveway/fence preservation after Art Director updates

---

## Version History

### Pre-v197 Changes (2025-12-03)
- Initial multi-model pipeline with OpenAI, Gemini Flash, and Nano Banana Pro
- Gemini Flash deprecated due to color accuracy issues
- Multiple API fixes for OpenAI endpoint and FormData handling
