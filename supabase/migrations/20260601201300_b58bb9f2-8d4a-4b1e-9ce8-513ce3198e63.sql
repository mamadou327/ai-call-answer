ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS deposit_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_reminder_hours integer NOT NULL DEFAULT 24;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_reminder_sent boolean NOT NULL DEFAULT false;