
CREATE TABLE public.outbound_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_hours jsonb NOT NULL DEFAULT '{
    "monday":    {"enabled": true,  "start": "10:00", "end": "17:00"},
    "tuesday":   {"enabled": true,  "start": "10:00", "end": "17:00"},
    "wednesday": {"enabled": true,  "start": "10:00", "end": "17:00"},
    "thursday":  {"enabled": true,  "start": "10:00", "end": "17:00"},
    "friday":    {"enabled": true,  "start": "10:00", "end": "17:00"},
    "saturday":  {"enabled": false, "start": "10:00", "end": "17:00"},
    "sunday":    {"enabled": false, "start": "10:00", "end": "17:00"}
  }'::jsonb,
  demo_duration_minutes int NOT NULL DEFAULT 15,
  buffer_minutes int NOT NULL DEFAULT 15,
  min_notice_hours int NOT NULL DEFAULT 2,
  max_demos_per_day int NOT NULL DEFAULT 4,
  timezone text NOT NULL DEFAULT 'Europe/London',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_availability TO authenticated;
GRANT ALL ON public.outbound_availability TO service_role;

ALTER TABLE public.outbound_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage outbound_availability"
  ON public.outbound_availability FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER outbound_availability_set_updated_at
  BEFORE UPDATE ON public.outbound_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.outbound_availability DEFAULT VALUES;

CREATE TABLE public.outbound_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  start_time time NULL,
  end_time time NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbound_availability_overrides_date_idx
  ON public.outbound_availability_overrides(date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_availability_overrides TO authenticated;
GRANT ALL ON public.outbound_availability_overrides TO service_role;

ALTER TABLE public.outbound_availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage outbound_availability_overrides"
  ON public.outbound_availability_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
