# 5-Star Photos - Authentication & User Management Implementation Plan

## Overview

This document outlines the implementation plan for user accounts, authentication, and the token-based economy for the 5-Star Photos app.

---

## User Types

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Admin** | Full system access | All features + admin dashboard, user management, system configuration |
| **User** | Logged-in account holder | Unlimited uploads, view history, save/download results, purchase tokens |
| **Viewer** | Anonymous or limited user | Upload up to 3 images (watermarked previews only), vote on comparisons |

---

## Database Schema

### New Tables Required

```sql
-- 1. User Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text default 'viewer' check (role in ('admin', 'user', 'viewer')),
  token_balance integer default 0,
  free_uploads_used integer default 0,
  free_uploads_limit integer default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Token Transactions (audit trail)
create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  amount integer not null,
  transaction_type text check (transaction_type in ('purchase', 'revision', 'upscale', 'refund', 'bonus')),
  description text,
  job_id uuid references public.jobs(id),
  created_at timestamptz default now()
);

-- 3. Update existing jobs table
alter table public.jobs add column user_id uuid references public.profiles(id);
alter table public.jobs add column is_watermarked boolean default true;
alter table public.jobs add column tokens_charged integer default 0;
```

### RLS Policies

```sql
-- Profiles: users can read/update their own profile
-- Admins can read all profiles
-- Token transactions: users can read their own, admins can read all
-- Jobs: users can see their own jobs, viewers can see shared jobs
```

---

## Authentication Flow

### Phase 1: Upload Trigger

```
1. User lands on homepage
2. User uploads 1-3 images (drag & drop or file picker)
3. Files are validated client-side (size, type, count)
4. BEFORE sending to models → Show Liquid Glass Login Modal
```

### Phase 2: Authentication Modal

```
┌─────────────────────────────────────────────┐
│                                             │
│     [Liquid Glass Modal]                    │
│                                             │
│     Sign in to enhance your photos          │
│                                             │
│     ┌─────────────────────────────────┐     │
│     │  Continue with Google           │     │
│     └─────────────────────────────────┘     │
│                                             │
│     ───────── or ─────────                  │
│                                             │
│     Email: [________________]               │
│     Password: [________________]            │
│                                             │
│     [Sign In]  [Create Account]             │
│                                             │
│     Skip for now (3 free previews)          │
│                                             │
└─────────────────────────────────────────────┘
```

### Phase 3: Post-Authentication

```
IF authenticated as User:
  → Send images to models
  → Generate 1024x768 NON-watermarked previews
  → Show results with approval/revision options
  
IF skipped (Viewer mode):
  → Check free_uploads_used < 3
  → Send images to models
  → Generate 1024x768 WATERMARKED previews
  → Show results with "Create account to download" CTA
```

---

## Token Economy

### Token Costs (Suggested)

| Action | Token Cost |
|--------|------------|
| Free preview (viewer) | 0 (watermarked, up to 3) |
| Revision request | 1 token |
| HD Upscale download | 5 tokens |
| Bulk download (10+ images) | 40 tokens |

### Token Acquisition

- **Sign-up bonus**: 10 free tokens
- **Purchase packages**: 
  - 20 tokens = $4.99
  - 50 tokens = $9.99
  - 100 tokens = $14.99

---

## Implementation Tasks

### Task 1: Database Setup
- [ ] Create profiles table with trigger for auto-creation on signup
- [ ] Create token_transactions table
- [ ] Update jobs table with user_id and watermark columns
- [ ] Set up RLS policies

### Task 2: Auth Infrastructure
- [ ] Create proxy.ts (middleware) for session management
- [ ] Create lib/supabase/server.ts and lib/supabase/client.ts
- [ ] Set up auth callback route (/auth/callback)
- [ ] Create useUser hook for client-side auth state

### Task 3: Liquid Glass Auth Modal
- [ ] Build modal component with glassmorphism design
- [ ] Email/password sign in form
- [ ] Email/password sign up form  
- [ ] Google OAuth button
- [ ] "Skip for now" option for viewer mode
- [ ] Form validation and error handling

### Task 4: Protected Routes & Role Checks
- [ ] Create middleware to protect routes by role
- [ ] Admin-only routes (/admin/*)
- [ ] User-only routes (/dashboard, /history)
- [ ] Auth context provider

### Task 5: Upload Flow Integration
- [ ] Intercept upload with auth modal
- [ ] Track free_uploads_used for viewers
- [ ] Apply watermark logic based on user role
- [ ] Connect jobs to user_id

### Task 6: Token System
- [ ] Token balance display in header
- [ ] Token deduction for revisions
- [ ] Token deduction for upscales
- [ ] Transaction history page
- [ ] Stripe integration for purchases (future)

### Task 7: Revision Flow
- [ ] "Request Revision" modal with text input
- [ ] Token check before submission
- [ ] Re-run Art Director with user feedback
- [ ] Generate new variations

### Task 8: Download/Upscale Flow
- [ ] Token check before HD download
- [ ] Upscale API integration
- [ ] Remove watermark on paid download
- [ ] Download tracking

---

## File Structure (New Files)

```
app/
├── auth/
│   ├── callback/route.ts      # OAuth callback handler
│   ├── login/page.tsx         # Login page (fallback)
│   └── sign-up/page.tsx       # Sign-up page (fallback)
├── dashboard/
│   └── page.tsx               # User dashboard / history
├── admin/
│   └── page.tsx               # Admin panel (existing, add auth)
│
components/
├── auth/
│   ├── auth-modal.tsx         # Liquid glass login modal
│   ├── auth-provider.tsx      # Auth context provider
│   ├── login-form.tsx         # Email/password login
│   ├── signup-form.tsx        # Email/password signup
│   └── google-auth-button.tsx # Google OAuth button
├── token-balance.tsx          # Header token display
└── revision-modal.tsx         # Request revision modal
│
lib/
├── supabase/
│   ├── client.ts              # Browser client (exists)
│   ├── server.ts              # Server client (exists)
│   └── proxy.ts               # Middleware helpers (new)
├── auth-utils.ts              # Auth helper functions
└── token-utils.ts             # Token management functions
│
proxy.ts                       # Next.js middleware
│
scripts/
├── 010_create_profiles.sql
├── 011_create_token_transactions.sql
├── 012_update_jobs_user_id.sql
└── 013_rls_policies.sql
```

---

## Security Considerations

1. **RLS is mandatory** - All tables must have row-level security
2. **Role verification** - Always verify role server-side, never trust client
3. **Token operations** - All token deductions must be server-side with transactions
4. **Watermark enforcement** - Watermark applied server-side, not removable client-side
5. **Rate limiting** - Prevent abuse of free tier

---

## Migration Path

### Existing Data
- Existing jobs will have `user_id = null` (legacy/anonymous)
- Existing model_feedback will remain unchanged
- No data loss during migration

### Rollback Plan
- New columns are nullable, can be ignored
- Auth is additive, not destructive
- Feature flags can disable auth requirement

---

## Questions to Confirm Before Implementation

1. **Token pricing** - Are the suggested costs acceptable?
2. **Free tier limits** - 3 images lifetime, or reset monthly?
3. **Google OAuth** - Do we need to set up Google Cloud Console credentials?
4. **Watermark design** - What should the watermark look like?
5. **Email verification** - Required before full access, or optional?
6. **Revision limits** - Max revisions per image, or unlimited with tokens?

---

## Recommended Implementation Order

1. **Phase 1**: Database schema + Auth infrastructure (proxy, clients, callback)
2. **Phase 2**: Liquid Glass Auth Modal + basic login/signup
3. **Phase 3**: Protect upload flow with auth modal
4. **Phase 4**: User dashboard / history
5. **Phase 5**: Token system + revision flow
6. **Phase 6**: Upscale/download with token deduction
7. **Phase 7**: Stripe payment integration
8. **Phase 8**: Google OAuth

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 2-3 hours | None |
| Phase 2 | 2-3 hours | Phase 1 |
| Phase 3 | 1-2 hours | Phase 2 |
| Phase 4 | 2-3 hours | Phase 3 |
| Phase 5 | 3-4 hours | Phase 4 |
| Phase 6 | 2-3 hours | Phase 5 |
| Phase 7 | 4-6 hours | Phase 6 |
| Phase 8 | 1-2 hours | Phase 2 |

**Total: ~18-26 hours of implementation**

---

## Approval Checklist

- [ ] User types and roles approved
- [ ] Token pricing approved
- [ ] Database schema approved
- [ ] Auth flow approved
- [ ] Implementation order approved
- [ ] Ready to proceed with Phase 1
