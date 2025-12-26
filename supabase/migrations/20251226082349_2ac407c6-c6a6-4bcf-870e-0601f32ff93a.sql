-- Allow public read access to business_settings for online booking pages
CREATE POLICY "Public can view business settings for online booking"
ON public.business_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = business_settings.business_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
);