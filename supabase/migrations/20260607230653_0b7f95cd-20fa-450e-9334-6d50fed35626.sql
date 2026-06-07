UPDATE public.outbound_leads
SET call_recording_url =
  'https://zyqzypyncugihrawhppg.supabase.co/functions/v1/outbound-recording-proxy/'
  || regexp_replace(call_recording_url, '^.*/(RE[a-f0-9]+)(\.mp3)?$', '\1') || '.mp3'
WHERE call_recording_url LIKE 'https://api.twilio.com/%Recordings/RE%';