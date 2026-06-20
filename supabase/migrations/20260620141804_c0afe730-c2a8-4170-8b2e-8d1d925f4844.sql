
ALTER TABLE public.outbound_campaigns
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

ALTER TABLE public.outbound_leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_archived_at ON public.outbound_campaigns (archived_at);
CREATE INDEX IF NOT EXISTS idx_outbound_leads_archived_at ON public.outbound_leads (archived_at);
