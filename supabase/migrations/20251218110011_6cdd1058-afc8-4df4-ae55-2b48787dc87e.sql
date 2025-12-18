-- Add SMS reminder hours setting to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS sms_reminder_hours numeric DEFAULT 3;

-- Add comment for clarity
COMMENT ON COLUMN public.business_settings.sms_reminder_hours IS 'Number of hours before appointment to send SMS reminder (default 3)';