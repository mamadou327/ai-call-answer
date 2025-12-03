-- Add Twilio fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS twilio_webhook_token text UNIQUE,
ADD COLUMN IF NOT EXISTS twilio_phone_number text,
ADD COLUMN IF NOT EXISTS twilio_enabled boolean DEFAULT false;

-- Create index for webhook token lookup
CREATE INDEX IF NOT EXISTS idx_businesses_twilio_webhook_token 
ON public.businesses(twilio_webhook_token) 
WHERE twilio_webhook_token IS NOT NULL;

-- Add twilio_call_sid to calls_log if not exists
ALTER TABLE public.calls_log
ADD COLUMN IF NOT EXISTS twilio_call_sid text,
ADD COLUMN IF NOT EXISTS to_number text;