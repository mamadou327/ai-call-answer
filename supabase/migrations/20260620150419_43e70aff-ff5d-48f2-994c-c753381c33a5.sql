
CREATE TABLE public.outbound_lead_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.outbound_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outbound_campaigns(id) ON DELETE SET NULL,
  retell_call_id text,
  twilio_call_sid text,
  recording_url text,
  transcript text,
  duration_seconds integer,
  outcome text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbound_lead_calls_lead_idx ON public.outbound_lead_calls(lead_id, called_at DESC);
CREATE UNIQUE INDEX outbound_lead_calls_retell_uniq ON public.outbound_lead_calls(retell_call_id) WHERE retell_call_id IS NOT NULL;
CREATE UNIQUE INDEX outbound_lead_calls_twilio_uniq ON public.outbound_lead_calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_lead_calls TO authenticated;
GRANT ALL ON public.outbound_lead_calls TO service_role;

ALTER TABLE public.outbound_lead_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage outbound_lead_calls"
ON public.outbound_lead_calls
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.outbound_lead_calls
  (lead_id, campaign_id, retell_call_id, twilio_call_sid, recording_url, transcript, duration_seconds, outcome, called_at)
SELECT
  l.id,
  l.campaign_id,
  l.retell_call_id,
  l.twilio_call_sid,
  l.call_recording_url,
  l.call_transcript,
  l.call_duration_seconds,
  l.status,
  COALESCE(l.last_called_at, l.created_at)
FROM public.outbound_leads l
WHERE l.call_recording_url IS NOT NULL
   OR l.call_transcript IS NOT NULL
   OR l.retell_call_id IS NOT NULL
   OR l.twilio_call_sid IS NOT NULL;
