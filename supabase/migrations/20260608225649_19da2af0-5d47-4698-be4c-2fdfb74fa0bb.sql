ALTER TABLE public.outbound_settings ADD COLUMN IF NOT EXISTS retell_agent_id text;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS retell_call_id text;
CREATE INDEX IF NOT EXISTS idx_outbound_leads_retell_call_id ON public.outbound_leads(retell_call_id);