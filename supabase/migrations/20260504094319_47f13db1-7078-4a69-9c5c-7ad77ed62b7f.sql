-- Add website sync tracking columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS website_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_last_synced_url text,
  ADD COLUMN IF NOT EXISTS website_pending_changes jsonb;

-- Sync log table
CREATE TABLE IF NOT EXISTS public.website_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL DEFAULT now(),
  url text,
  changes_detected boolean NOT NULL DEFAULT false,
  changes_summary jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_website_sync_log_business ON public.website_sync_log(business_id, synced_at DESC);

ALTER TABLE public.website_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their website sync log"
  ON public.website_sync_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = website_sync_log.business_id AND b.owner_id = auth.uid()
  ));

CREATE POLICY "Business owners can update their website sync log"
  ON public.website_sync_log FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = website_sync_log.business_id AND b.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can view all website sync log"
  ON public.website_sync_log FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;