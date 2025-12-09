-- Add elevenlabs_voice_id column to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text DEFAULT NULL;