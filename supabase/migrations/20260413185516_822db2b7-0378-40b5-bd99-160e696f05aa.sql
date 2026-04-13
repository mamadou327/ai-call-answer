
-- 1. Add reservation_platform to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS reservation_platform text DEFAULT 'none';

-- 2. Add allergens to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS allergens text[] DEFAULT ARRAY[]::text[];

-- 3. Create fallback_reservations table
CREATE TABLE public.fallback_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  party_size integer NOT NULL DEFAULT 2,
  reservation_time timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 90,
  special_requests text,
  allergen_info text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  notified_at timestamp with time zone,
  entered_at timestamp with time zone,
  call_id uuid REFERENCES public.calls_log(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fallback_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their fallback reservations"
ON public.fallback_reservations FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses 
  WHERE businesses.id = fallback_reservations.business_id 
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Super admins can view all fallback reservations"
ON public.fallback_reservations FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_fallback_reservations_updated_at
BEFORE UPDATE ON public.fallback_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create missed_calls table
CREATE TABLE public.missed_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  caller_phone text NOT NULL,
  caller_name text,
  call_time timestamp with time zone NOT NULL DEFAULT now(),
  reason text DEFAULT 'abandoned',
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamp with time zone,
  followed_up boolean NOT NULL DEFAULT false,
  followed_up_at timestamp with time zone,
  call_sid text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their missed calls"
ON public.missed_calls FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses 
  WHERE businesses.id = missed_calls.business_id 
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Business owners can update their missed calls"
ON public.missed_calls FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM businesses 
  WHERE businesses.id = missed_calls.business_id 
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Super admins can view all missed calls"
ON public.missed_calls FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime for missed_calls so dashboard updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.missed_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fallback_reservations;
