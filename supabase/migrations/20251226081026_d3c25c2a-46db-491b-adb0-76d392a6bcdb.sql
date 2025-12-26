-- Drop the existing policy that only applies to anon users
DROP POLICY IF EXISTS "Public can view staff for online booking" ON public.staff;

-- Create new policy that works for both anon and authenticated users
CREATE POLICY "Anyone can view staff for online booking"
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
  AND EXISTS (
    SELECT 1 FROM public.staff_services ss WHERE ss.staff_id = staff.id
  )
);