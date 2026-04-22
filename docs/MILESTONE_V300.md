# Milestone V300 - Production-Ready Photo Library System

**Date**: April 2026  
**Status**: STABLE CHECKPOINT  
**Previous Milestone**: V290

## Overview

V300 represents a major architectural milestone for 5star.photos. The application has evolved from a simple job-based enhancement flow to a full-featured photo library system with persistent storage, project organization, and a robust token economy (currently in development mode with tokens disabled). This milestone documents the complete working state before implementing subscription billing and user account management.

## Architecture Summary

### Core User Flow

1. **Landing Page** (`/enhance`) - Unauthenticated users see upload interface, redirects to library if authenticated
2. **Authentication** - Supabase Auth with email/password and OAuth support
3. **Photo Library** (`/library`) - Authenticated users manage their photos and projects
4. **Transform Page** (`/transform/[imageId]`) - AI-powered image enhancement with 3 model variations
5. **Preview/Download** - View results with watermarked previews, download hi-res versions

### Database Schema (9 Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts, token balances, roles | `id`, `email`, `tokens`, `role`, `free_previews_limit/used` |
| `images` | Photo library with parent/child relationships | `id`, `user_id`, `parent_image_id`, `storage_path`, `is_original`, `source_model` |
| `projects` | Property groupings for photos | `id`, `user_id`, `name`, `address`, `cover_image_id` |
| `jobs` | Legacy batch processing jobs | `id`, `user_id`, `status`, `file_list` (JSONB) |
| `model_feedback` | Thumbs up/down on AI variations | `model_provider`, `feedback_type`, `is_exemplary` |
| `token_transactions` | Token usage audit trail | `type`, `amount`, `description` |
| `shared_comparisons` | Public share links for A/B comparisons | `share_token`, `expires_at` |
| `comparison_votes` | Anonymous voting on shared comparisons | `voted_version`, `voter_ip` |

All tables have RLS (Row Level Security) policies enforcing user-level data isolation.

### AI Model Configuration

Three active providers process images in parallel:

| Variation | Model | Provider | Notes |
|-----------|-------|----------|-------|
| V1 | GPT Image 1.5 | OpenAI | Latest model, 4x faster, best quality |
| V2 | Nano Banana Pro | FAL (Gemini 3 Pro) | Art Director analysis, photorealistic |
| V3 | Flux 2 Pro | FAL | Experimental, high fidelity |

**Anti-Hallucination System**: All models use strict constraints preventing:
- Adding vegetation to hard surfaces
- Removing structural elements
- Changing architectural styles
- Adding objects not in original

### Token Economy (Development Mode)

Token costs are defined but currently bypassed for testing:

| Action | Cost | Status |
|--------|------|--------|
| Upload | 1 token | FREE |
| Transform (first) | 0 tokens | FREE |
| Re-transform | 1 token | FREE |
| Save Variation | 1 token | FREE |
| Download Hi-Res | 4 tokens | FREE |

Users see "Development Mode: All features are currently FREE" banner.

## File Structure

```
app/
├── page.tsx                    # Landing page with hero
├── enhance/page.tsx            # Upload flow for unauthenticated users
├── library/page.tsx            # Photo library (authenticated)
├── library/projects/[projectId]/page.tsx  # Project detail view
├── transform/[imageId]/page.tsx           # AI enhancement page
├── preview/[jobId]/page.tsx    # Legacy job preview
├── download/[jobId]/page.tsx   # Legacy job download
├── batch-transform/page.tsx    # Batch enhancement (WIP)
├── history/page.tsx            # Enhancement history
├── admin/page.tsx              # Admin dashboard
├── admin/training/page.tsx     # Model training data review
├── auth/
│   ├── login/page.tsx          # Login form
│   ├── signup/page.tsx         # Signup form
│   ├── callback/route.ts       # OAuth callback handler
│   └── error/page.tsx          # Auth error display

api/
├── art-director/route.ts       # Gemini vision analysis
├── edit-image/route.ts         # Multi-model image enhancement
├── upscale/route.ts            # Hi-res generation
├── save-variation/route.ts     # Save variation to library
├── upload-reference/route.ts   # Reference image upload
├── import-airbnb/route.ts      # Airbnb listing scraper
├── qa-curator/route.ts         # Automated QA analysis
├── jobs/[jobId]/route.ts       # Legacy job status

lib/
├── actions/
│   ├── auth-actions.ts         # Signup, login, profile management
│   ├── image-actions.ts        # Upload, transform, save, delete
│   ├── job-actions.ts          # Legacy job processing
│   ├── project-actions.ts      # Project CRUD
│   ├── feedback-actions.ts     # Model feedback submission
│   └── token-actions.ts        # Token balance management
├── supabase/
│   ├── client.ts               # Browser client
│   ├── server.ts               # Server client (SSR)
│   ├── direct.ts               # Direct client (service role)
│   └── proxy.ts                # Middleware proxy
├── contexts/auth-context.tsx   # Auth state provider
├── hooks/use-auth.ts           # Auth hook with profile
├── types.ts                    # TypeScript interfaces
├── constants/tokens.ts         # Token cost constants
└── utils/watermark.ts          # Canvas-based watermarking

components/
├── header.tsx                  # App header with user menu
├── sidebar.tsx                 # Navigation sidebar
├── image-library.tsx           # Photo grid with selection
├── image-uploader.tsx          # Drag-drop uploader
├── projects-view.tsx           # Project cards and creation
├── airbnb-import-modal.tsx     # Airbnb URL import
├── auth-modal.tsx              # Auth prompt modal
├── enhancement-preferences-modal.tsx  # Batch enhancement settings
├── single-image-preferences-modal.tsx # Per-image settings
├── download-selection-modal.tsx       # Download options
├── preview-grid.tsx            # Variation comparison grid
├── preview-modal.tsx           # Full-screen comparison
├── before-after-slider.tsx     # Swipe comparison
├── upload-card.tsx             # File drop zone
└── user-menu.tsx               # Profile dropdown
```

## Key Features

### 1. Photo Library System
- **Upload**: Drag-drop or file picker, automatic classification (indoor/outdoor)
- **Organization**: Grid view with selection, projects for grouping by property
- **Storage**: Supabase Storage with public URLs, original + variations hierarchy

### 2. AI Enhancement Pipeline
- **Art Director**: Gemini 3 Flash analyzes photo and generates enhancement prompts
- **Parallel Processing**: 3 models process simultaneously
- **Auto-Save**: Successful variations automatically saved to library
- **Feedback Loop**: Thumbs up/down ratings inform model training

### 3. Enhancement Preferences
- **Outdoor Options**: Sky replacement, virtual twilight, lawn enhancement
- **Indoor Options**: Window balance, declutter, color temperature
- **Universal**: Straighten verticals, zoom out presets
- **Custom Instructions**: Free-text Art Director guidance
- **Reference Images**: Upload style reference for consistency

### 4. Airbnb Import
- Paste Airbnb listing URL
- Scrapes property images via API
- Imports to specified project with attribution

### 5. Authentication Flow
- Supabase Auth with cookie-based sessions
- SSR middleware validates tokens
- Profile auto-creation on signup (10 tokens default)
- Free preview limit for viewer role (3 previews)

### 6. Admin Features
- User management dashboard
- Model feedback review
- Training data curation (exemplary examples)
- Token grants/deductions

## API Routes Detail

### `/api/edit-image`
Core enhancement endpoint handling all 3 models:
- Accepts: `original_url`, `model`, `preferences`, `image_prompt`
- Watermarks all preview outputs
- Returns base64 data URL

### `/api/art-director`
Gemini-powered image analysis:
- Classifies indoor/outdoor
- Identifies scene elements
- Generates enhancement prompt
- Respects user preferences

### `/api/save-variation`
Persists variation to library:
- Uploads base64 to Supabase Storage
- Creates `images` record with parent reference
- Links to source model for feedback tracking

### `/api/upscale`
Hi-res generation (planned):
- Currently returns original resolution
- Will integrate Real-ESRGAN or similar

## Environment Variables

Required (all configured):
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# AI Providers
OPENAI_API_KEY
FAL_KEY

# App Config
NEXT_PUBLIC_SITE_URL (optional)
```

## Known Issues & Technical Debt

### Active Issues
1. **Tokens Disabled**: All token costs bypassed for development testing
2. **Upscale Not Implemented**: Returns preview resolution
3. **Reference Images**: Uploaded but not fully integrated into prompts

### Technical Debt
1. **Dual Systems**: Legacy job-based flow coexists with new image library
2. **Multiple Supabase Clients**: 4 different client patterns (needs consolidation)
3. **Hardcoded Models**: Model configuration should be database-driven
4. **No Caching**: Art Director calls not cached (same image re-analyzed)

## Security Considerations

- RLS policies on all tables
- Service role key only used server-side
- User data isolated by `user_id` foreign key
- Storage buckets have public read (intentional for CDN)
- Watermarks prevent unauthorized commercial use

## Performance Characteristics

- **Upload**: ~2s for 2MB image
- **Transform**: 30-60s for all 3 models
- **Library Load**: <500ms for 50 images
- **Auto-save**: Runs in background after transform

## Testing Checklist

- [x] User signup/login
- [x] Profile creation with tokens
- [x] Image upload to library
- [x] Photo classification
- [x] Project creation
- [x] Image to project assignment
- [x] Transform with all 3 models
- [x] Auto-save variations
- [x] Feedback submission
- [x] Airbnb import
- [x] Download (watermarked preview)
- [x] Admin dashboard access

## Next Steps (Not Implemented)

### Immediate (V301)
1. **Stripe Integration**: Subscription billing
2. **Token Purchases**: One-time token packs
3. **Enable Token Deductions**: Remove development bypass

### Future
1. **User Account Management**: Profile editing, password reset
2. **Subscription Tiers**: Free, Pro, Business plans
3. **Usage Analytics**: Track model performance
4. **Batch Processing Queue**: Background job system
5. **Model Selection**: Let users choose which models to run
6. **Upscale Implementation**: Real hi-res generation

## Rollback Instructions

This is a stable checkpoint. To restore:
1. Database: No schema changes since V290
2. Key files to preserve:
   - `lib/actions/image-actions.ts`
   - `lib/actions/project-actions.ts`
   - `app/library/page.tsx`
   - `app/transform/[imageId]/page.tsx`
   - `components/image-library.tsx`

## Conclusion

V300 establishes a solid foundation for 5star.photos as a photo library platform with AI enhancement capabilities. The token economy infrastructure is in place but disabled for testing. Authentication, storage, and the enhancement pipeline are all production-ready. The next phase will focus on monetization with Stripe integration and enabling the token system.

**Status**: Ready for subscription billing implementation
