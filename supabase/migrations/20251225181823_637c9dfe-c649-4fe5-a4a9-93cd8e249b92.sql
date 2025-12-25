-- Allow public to view staff_services for online booking enabled businesses
CREATE POLICY "Public can view staff_services for online booking"
ON public.staff_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id = staff_services.staff_id
    AND b.online_booking_enabled = true
    AND b.status = 'approved'
  )
);