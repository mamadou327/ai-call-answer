-- Fix 1: Recreate business insert policy for authenticated owners
DROP POLICY IF EXISTS "Owners insert own business" ON public.businesses;
CREATE POLICY "Owners insert own business"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Fix 2: pg_cron / pg_net scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any existing jobs with these names (re-runnable)
DO $$
DECLARE
  jname text;
BEGIN
  FOREACH jname IN ARRAY ARRAY[
    'auto-cancel-unpaid-bookings',
    'check-unpaid-deposits',
    'send-booking-reminders',
    'generate-recurring-tasks'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = jname) THEN
      PERFORM cron.unschedule(jname);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'auto-cancel-unpaid-bookings',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/auto-cancel-unpaid-bookings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'check-unpaid-deposits',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/check-unpaid-deposits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'send-booking-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'generate-recurring-tasks',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/generate-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);