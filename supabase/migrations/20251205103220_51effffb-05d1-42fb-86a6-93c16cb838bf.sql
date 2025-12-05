-- Add MessageBird fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS messagebird_phone_number text,
ADD COLUMN IF NOT EXISTS messagebird_token text UNIQUE,
ADD COLUMN IF NOT EXISTS messagebird_enabled boolean NOT NULL DEFAULT false;

-- Add provider field to calls_log for distinguishing between Twilio and MessageBird
ALTER TABLE public.calls_log 
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'twilio';

-- Create index on messagebird_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_businesses_messagebird_token ON public.businesses(messagebird_token) WHERE messagebird_token IS NOT NULL;