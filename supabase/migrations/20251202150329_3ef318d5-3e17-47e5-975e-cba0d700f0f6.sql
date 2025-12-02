-- Add profile fields to staff_memberships table
ALTER TABLE public.staff_memberships
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS chair text;