DELETE FROM public.outbound_demos a
USING public.outbound_demos b
WHERE a.lead_id = b.lead_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS outbound_demos_lead_id_unique ON public.outbound_demos(lead_id);