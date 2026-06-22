
-- Allow active staff to read call conversations for their business
CREATE POLICY "Staff can view call conversations of their business"
ON public.call_conversations
FOR SELECT
TO authenticated
USING (public.is_staff_member_of_business(auth.uid(), business_id));

-- Allow active staff to read time-off records for their business
CREATE POLICY "Staff can view time off of their business"
ON public.staff_time_off
FOR SELECT
TO authenticated
USING (public.is_staff_member_of_business(auth.uid(), business_id));

-- Allow public (anonymous) read of customer_settings for businesses with online booking enabled
GRANT SELECT ON public.customer_settings TO anon;

CREATE POLICY "Public can view customer settings for bookable businesses"
ON public.customer_settings
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = customer_settings.business_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
);
