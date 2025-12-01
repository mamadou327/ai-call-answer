-- Add color field to staff table for calendar color-coding
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS color text DEFAULT '#3B82F6';