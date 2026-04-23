-- =====================================================
-- TOKEN TRANSACTIONS TABLE
-- Tracks all token credits and debits for auditing
-- =====================================================

-- Create transaction type enum
DO $$ BEGIN
  CREATE TYPE token_transaction_type AS ENUM (
    'purchase',           -- User bought tokens
    'signup_bonus',       -- Free tokens on signup
    'revision',           -- Spent on image revision
    'upscale',            -- Spent on high-quality upscale
    'refund',             -- Refunded tokens
    'admin_grant',        -- Admin manually added tokens
    'admin_deduct'        -- Admin manually removed tokens
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create token transactions table
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type token_transaction_type NOT NULL,
  amount INTEGER NOT NULL, -- Positive for credits, negative for debits
  balance_after INTEGER NOT NULL, -- User's token balance after this transaction
  description TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  file_name TEXT, -- For tracking which file the tokens were spent on
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL -- For admin actions
);

-- Enable RLS
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own transactions
CREATE POLICY "token_transactions_select_own"
  ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "token_transactions_select_admin"
  ON public.token_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only server-side can insert (via service role)
-- No direct insert policy for regular users

-- Create indexes
CREATE INDEX IF NOT EXISTS token_transactions_user_id_idx ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS token_transactions_created_at_idx ON public.token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS token_transactions_type_idx ON public.token_transactions(type);
CREATE INDEX IF NOT EXISTS token_transactions_job_id_idx ON public.token_transactions(job_id);
