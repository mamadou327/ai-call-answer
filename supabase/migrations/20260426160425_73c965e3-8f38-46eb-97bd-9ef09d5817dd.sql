-- 1. Subscription tier enum
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('starter', 'growth', 'scale', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add column to business_settings (default starter)
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier NOT NULL DEFAULT 'starter';

-- 3. Helper: count calls for a business in the current calendar month
CREATE OR REPLACE FUNCTION public.get_current_month_call_count(p_business_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.calls_log
  WHERE business_id = p_business_id
    AND created_at >= date_trunc('month', now())
    AND created_at <  date_trunc('month', now()) + interval '1 month';
$$;

-- 4. Notification log so each threshold email fires at most once per month
CREATE TABLE IF NOT EXISTS public.call_usage_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  month_start date NOT NULL,
  threshold smallint NOT NULL CHECK (threshold IN (75, 90, 100)),
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (business_id, month_start, threshold)
);

ALTER TABLE public.call_usage_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their usage notifications"
ON public.call_usage_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = call_usage_notifications.business_id
      AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Super admins view all usage notifications"
ON public.call_usage_notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_call_usage_notifications_business_month
  ON public.call_usage_notifications (business_id, month_start);