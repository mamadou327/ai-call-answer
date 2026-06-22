ALTER TABLE public.voice_library
  ADD COLUMN IF NOT EXISTS verified_languages text[] NOT NULL DEFAULT ARRAY['en']::text[],
  ADD COLUMN IF NOT EXISTS is_multilingual boolean NOT NULL DEFAULT false;