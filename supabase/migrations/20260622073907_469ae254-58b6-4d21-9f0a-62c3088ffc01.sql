
-- Helper that bypasses RLS to check if a business is publicly bookable.
-- Needed so anon's RLS policies on services/opening_hours can verify business eligibility
-- without requiring direct anon SELECT on the businesses table.
CREATE OR REPLACE FUNCTION public.is_business_publicly_bookable(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id
      AND online_booking_enabled = true
      AND status = 'approved'::business_status
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_business_publicly_bookable(uuid) TO anon, authenticated;

-- Re-create the public SELECT policies on services & opening_hours using the helper.
DROP POLICY IF EXISTS "Public can view services for online booking" ON public.services;
CREATE POLICY "Public can view services for online booking"
  ON public.services FOR SELECT
  USING (public.is_business_publicly_bookable(business_id));

DROP POLICY IF EXISTS "Public can view opening hours for online booking" ON public.opening_hours;
CREATE POLICY "Public can view opening hours for online booking"
  ON public.opening_hours FOR SELECT
  USING (public.is_business_publicly_bookable(business_id));
