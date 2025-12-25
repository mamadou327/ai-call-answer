-- Update public staff visibility for online booking.
-- Previously, public staff visibility depended on staff.ai_enabled.
-- We now allow public SELECT for staff who belong to an approved business with online booking enabled
-- AND who are assigned to at least one service (via staff_services).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff'
      AND policyname = 'Public can view staff for online booking'
  ) THEN
    EXECUTE 'DROP POLICY "Public can view staff for online booking" ON public.staff';
  END IF;
END $$;

CREATE POLICY "Public can view staff assigned to services for online booking"
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
    SELECT 1
    FROM public.staff_services ss
    WHERE ss.staff_id = staff.id
  )
);
