-- Migration: Create images table for the new single-image library system
-- This replaces the complex job/file relationship with a cleaner image-centric model

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  original_filename TEXT NOT NULL,
  classification TEXT DEFAULT 'unknown' CHECK (classification IN ('indoor', 'outdoor', 'unknown')),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_original BOOLEAN DEFAULT true,
  source_model TEXT,
  transformation_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_parent_id ON images(parent_image_id);
CREATE INDEX IF NOT EXISTS idx_images_is_original ON images(is_original);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

-- Enable RLS
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own images
CREATE POLICY images_select_own ON images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY images_insert_own ON images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY images_update_own ON images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY images_delete_own ON images
  FOR DELETE USING (auth.uid() = user_id);

-- Add new token transaction types to support the new flow
-- The existing 'type' column is TEXT, so we just document the new types:
-- 'upload' - uploading an original image (1 token)
-- 'transform' - re-running transformation (1 token)  
-- 'save_variation' - saving a variation as new base image (1 token)
-- 'download_hires' - downloading high-res non-watermarked (4 tokens)

-- Add image_id column to token_transactions to link transactions to specific images
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS image_id UUID REFERENCES images(id) ON DELETE SET NULL;

-- Create index for image_id lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_image_id ON token_transactions(image_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS images_updated_at_trigger ON images;
CREATE TRIGGER images_updated_at_trigger
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_images_updated_at();
