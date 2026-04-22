-- =====================================================
-- UPDATE JOBS TABLE FOR USER OWNERSHIP
-- Adds user_id column and updates RLS policies
-- =====================================================

-- Add user_id column to jobs table (nullable for backwards compatibility)
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add is_watermarked flag for preview images
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_watermarked BOOLEAN NOT NULL DEFAULT true;

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON public.jobs(user_id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "jobs_select_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_all" ON public.jobs;

-- New RLS Policies for jobs

-- Logged-in users can see their own jobs
CREATE POLICY "jobs_select_own"
  ON public.jobs FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL  -- Legacy jobs without user_id
  );

-- Admins can see all jobs
CREATE POLICY "jobs_select_admin"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Logged-in users can create jobs (user_id must match)
CREATE POLICY "jobs_insert_authenticated"
  ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Users can update their own jobs
CREATE POLICY "jobs_update_own"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any job
CREATE POLICY "jobs_update_admin"
  ON public.jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any job
CREATE POLICY "jobs_delete_admin"
  ON public.jobs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
