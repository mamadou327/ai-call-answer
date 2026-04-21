ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS use_elevenlabs_voice boolean NOT NULL DEFAULT false;

ALTER TABLE public.calls_log
  ADD COLUMN IF NOT EXISTS elevenlabs_chars_used integer NOT NULL DEFAULT 0;