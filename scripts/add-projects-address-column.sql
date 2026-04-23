-- Add missing address column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;
