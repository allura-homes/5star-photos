-- =====================================================
-- SHARED COMPARISONS TABLE
-- Allows users to share image comparisons for public voting
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shared_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  title TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  vote_count_v1 INTEGER NOT NULL DEFAULT 0,
  vote_count_v2 INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.shared_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view active shared comparisons (public voting)
CREATE POLICY "shared_comparisons_select_public"
  ON public.shared_comparisons FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Users can view their own shared comparisons
CREATE POLICY "shared_comparisons_select_own"
  ON public.shared_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create shared comparisons for their own jobs
CREATE POLICY "shared_comparisons_insert_own"
  ON public.shared_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own shared comparisons
CREATE POLICY "shared_comparisons_update_own"
  ON public.shared_comparisons FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own shared comparisons
CREATE POLICY "shared_comparisons_delete_own"
  ON public.shared_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS shared_comparisons_user_id_idx ON public.shared_comparisons(user_id);
CREATE INDEX IF NOT EXISTS shared_comparisons_share_token_idx ON public.shared_comparisons(share_token);
CREATE INDEX IF NOT EXISTS shared_comparisons_job_id_idx ON public.shared_comparisons(job_id);

-- Table to track votes (prevents duplicate voting)
CREATE TABLE IF NOT EXISTS public.comparison_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NOT NULL REFERENCES public.shared_comparisons(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL for anonymous voters
  voter_ip TEXT, -- For anonymous vote deduplication
  voted_version TEXT NOT NULL CHECK (voted_version IN ('v1', 'v2')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Prevent duplicate votes
  UNIQUE(comparison_id, voter_id),
  UNIQUE(comparison_id, voter_ip)
);

-- Enable RLS
ALTER TABLE public.comparison_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a vote (public voting)
CREATE POLICY "comparison_votes_insert_public"
  ON public.comparison_votes FOR INSERT
  WITH CHECK (true);

-- Only admins can view individual votes
CREATE POLICY "comparison_votes_select_admin"
  ON public.comparison_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS comparison_votes_comparison_id_idx ON public.comparison_votes(comparison_id);
