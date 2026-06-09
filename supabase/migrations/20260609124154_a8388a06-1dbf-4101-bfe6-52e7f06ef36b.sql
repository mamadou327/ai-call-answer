ALTER TABLE public.outbound_settings
  ADD COLUMN IF NOT EXISTS demo_available_days text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  ADD COLUMN IF NOT EXISTS demo_start_hour integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS demo_end_hour integer NOT NULL DEFAULT 18;