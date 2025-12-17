-- Add is_archived column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;