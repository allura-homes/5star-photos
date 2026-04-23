-- Update the style_mode check constraint to support new enhancement modes
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_style_mode_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_style_mode_check 
  CHECK (style_mode IN ('daylight_4000k', 'cotton_candy_dusk', 'full_5star_fix', 'enhance_warm', 'enhance_cool', 'reimagine_ai'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'jobs_style_mode_check';
