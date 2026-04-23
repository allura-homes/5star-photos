-- Create model_feedback table for storing training data
CREATE TABLE IF NOT EXISTS model_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Job and file reference
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  
  -- Model information
  model_provider text NOT NULL CHECK (model_provider IN ('openai', 'gemini_flash', 'nano_banana_pro')),
  variation_number integer NOT NULL,
  
  -- Feedback data
  feedback_type text NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down')),
  feedback_notes text,
  
  -- Image URLs for reference
  original_url text,
  result_url text,
  
  -- Style mode used
  style_mode text,
  
  -- Art director prompt used
  prompt_used text,
  
  -- User who gave feedback (for future auth)
  user_id uuid,
  
  -- Whether this is marked as exemplary (for few-shot examples)
  is_exemplary boolean DEFAULT false
);

-- Create index for querying by model
CREATE INDEX IF NOT EXISTS idx_model_feedback_provider ON model_feedback(model_provider);

-- Create index for querying exemplary examples
CREATE INDEX IF NOT EXISTS idx_model_feedback_exemplary ON model_feedback(is_exemplary) WHERE is_exemplary = true;

-- Enable RLS
ALTER TABLE model_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies (open for now, will be restricted to admins later)
CREATE POLICY "model_feedback_select_all" ON model_feedback FOR SELECT USING (true);
CREATE POLICY "model_feedback_insert_all" ON model_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "model_feedback_update_all" ON model_feedback FOR UPDATE USING (true);
CREATE POLICY "model_feedback_delete_all" ON model_feedback FOR DELETE USING (true);
