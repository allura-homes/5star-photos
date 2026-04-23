-- Create projects table for organizing images by property
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own projects
CREATE POLICY projects_select_own ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY projects_insert_own ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_update_own ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY projects_delete_own ON projects FOR DELETE USING (auth.uid() = user_id);

-- Add project_id column to images table
ALTER TABLE images ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);

-- Add foreign key for cover_image_id after images table has project_id
ALTER TABLE projects ADD CONSTRAINT fk_cover_image 
  FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL;
