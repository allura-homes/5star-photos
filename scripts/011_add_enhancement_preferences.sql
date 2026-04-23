-- Add enhancement preferences columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS enhancement_preferences JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS photo_classifications JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.enhancement_preferences IS 'User-selected enhancement preferences (sky replacement, virtual twilight, etc.)';
COMMENT ON COLUMN jobs.photo_classifications IS 'Array of {name, classification} for indoor/outdoor photo classification';
