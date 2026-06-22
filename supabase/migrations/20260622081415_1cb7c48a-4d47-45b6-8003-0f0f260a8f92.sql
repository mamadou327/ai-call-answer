ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS name_phonetic text;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS ai_can_suggest_addons boolean NOT NULL DEFAULT false;