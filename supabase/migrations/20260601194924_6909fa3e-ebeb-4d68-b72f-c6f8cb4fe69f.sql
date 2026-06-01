-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Remove any pre-existing cron_secret in the vault so we can re-create cleanly
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, '440c531034c1ea96ab8f180aa438e34c91cb6597f870adc1ced20baff4acb691', 'cron_secret');
  ELSE
    PERFORM vault.create_secret('440c531034c1ea96ab8f180aa438e34c91cb6597f870adc1ced20baff4acb691', 'cron_secret');
  END IF;
END $$;

-- Unschedule existing jobs (ignore errors)
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname IN (
    'auto-cancel-unpaid-bookings',
    'check-unpaid-deposits',
    'send-booking-reminders',
    'generate-recurring-tasks'
  ) LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- Schedule jobs (the secret is read from the vault at execution time)
SELECT cron.schedule(
  'auto-cancel-unpaid-bookings',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/auto-cancel-unpaid-bookings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
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
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
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
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
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
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
