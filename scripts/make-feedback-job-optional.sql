-- Make job_id nullable in model_feedback table to allow feedback without a job
-- Also add image_id column to link feedback directly to images

-- Drop the existing foreign key constraint
ALTER TABLE model_feedback 
DROP CONSTRAINT IF EXISTS model_feedback_job_id_fkey;

-- Make job_id nullable
ALTER TABLE model_feedback 
ALTER COLUMN job_id DROP NOT NULL;

-- Add image_id column for direct image feedback
ALTER TABLE model_feedback 
ADD COLUMN IF NOT EXISTS image_id uuid REFERENCES images(id) ON DELETE CASCADE;

-- Re-add foreign key constraint but allow NULL
ALTER TABLE model_feedback 
ADD CONSTRAINT model_feedback_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
