ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;