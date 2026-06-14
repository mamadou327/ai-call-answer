
-- Add email sequence columns to outbound_leads
ALTER TABLE public.outbound_leads
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email1_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email1_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS email2_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email2_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS email3_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email3_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS sequence_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequence_status text DEFAULT 'active';

-- Templates
CREATE TABLE IF NOT EXISTS public.outbound_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number BETWEEN 1 AND 3),
  subject text,
  body_html text NOT NULL,
  is_reply boolean DEFAULT false,
  delay_days integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_email_templates TO authenticated;
GRANT ALL ON public.outbound_email_templates TO service_role;
ALTER TABLE public.outbound_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates"
ON public.outbound_email_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_outbound_email_templates_updated_at
BEFORE UPDATE ON public.outbound_email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log
CREATE TABLE IF NOT EXISTS public.outbound_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.outbound_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  step_number integer,
  resend_email_id text,
  message_id text,
  subject text,
  status text DEFAULT 'sent',
  opened_at timestamptz,
  replied_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_email_log TO authenticated;
GRANT ALL ON public.outbound_email_log TO service_role;
ALTER TABLE public.outbound_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view email log"
ON public.outbound_email_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage email log"
ON public.outbound_email_log
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_outbound_email_log_lead ON public.outbound_email_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_outbound_email_log_campaign_step ON public.outbound_email_log(campaign_id, step_number);
CREATE INDEX IF NOT EXISTS idx_outbound_email_log_pending_reply ON public.outbound_email_log(replied_at, sent_at);
