-- Fix infinite recursion between staff and staff_services RLS policies

-- Drop the problematic recursive policy on staff
DROP POLICY IF EXISTS "Public can view staff assigned to services for online booking" ON public.staff;

-- Create a simpler policy that doesn't cause recursion
-- Use a direct subquery that bypasses RLS on staff_services
CREATE POLICY "Public can view staff for online booking"
ON public.staff
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = staff.business_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
  AND (
    SELECT COUNT(*) FROM public.staff_services ss 
    WHERE ss.staff_id = staff.id
  ) > 0
);

-- Update staff_services policy to check via services -> businesses instead of staff -> businesses
-- This breaks the circular reference
DROP POLICY IF EXISTS "Public can view staff_services for online booking" ON public.staff_services;

CREATE POLICY "Public can view staff_services for online booking"
ON public.staff_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.services srv
    JOIN public.businesses b ON b.id = srv.business_id
    WHERE srv.id = staff_services.service_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
);