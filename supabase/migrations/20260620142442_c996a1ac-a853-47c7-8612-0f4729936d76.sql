
CREATE TABLE public.outbound_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.outbound_leads(id) ON DELETE SET NULL,
  actor_user_id uuid,
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oce_campaign_created ON public.outbound_campaign_events (campaign_id, created_at DESC);
CREATE INDEX idx_oce_lead ON public.outbound_campaign_events (lead_id);
CREATE INDEX idx_oce_event_type ON public.outbound_campaign_events (event_type);

GRANT SELECT, INSERT ON public.outbound_campaign_events TO authenticated;
GRANT ALL ON public.outbound_campaign_events TO service_role;

ALTER TABLE public.outbound_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read campaign events"
  ON public.outbound_campaign_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin can insert campaign events"
  ON public.outbound_campaign_events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.log_campaign_event(
  p_campaign_id uuid,
  p_event_type text,
  p_message text,
  p_lead_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.outbound_campaign_events
    (campaign_id, lead_id, actor_user_id, event_type, message, details)
  VALUES
    (p_campaign_id, p_lead_id, auth.uid(), p_event_type, p_message, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_campaign_event(uuid, text, text, uuid, jsonb) TO authenticated, service_role;
