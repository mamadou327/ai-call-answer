-- Add SMS notification toggles to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS sms_on_confirmation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_on_cancellation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_on_reminder boolean NOT NULL DEFAULT false;