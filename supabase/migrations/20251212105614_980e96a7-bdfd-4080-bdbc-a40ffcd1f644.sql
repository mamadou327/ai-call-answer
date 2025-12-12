-- Add ai_enabled column to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;