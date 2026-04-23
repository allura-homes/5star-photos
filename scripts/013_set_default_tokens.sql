-- Migration: Set default tokens for new profiles to 3
-- This ensures new users get 3 free tokens to start with

-- Update the default value for new profiles
ALTER TABLE public.profiles 
ALTER COLUMN tokens SET DEFAULT 3;

-- Also give 3 tokens to any existing profiles that have 0 tokens
-- and haven't used any free previews yet (truly new users)
UPDATE public.profiles 
SET tokens = 3 
WHERE tokens = 0 
  AND free_previews_used = 0;
