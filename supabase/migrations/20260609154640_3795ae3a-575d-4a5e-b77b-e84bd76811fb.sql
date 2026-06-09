ALTER TABLE public.outbound_settings ADD COLUMN IF NOT EXISTS mo_phone_number text;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false;