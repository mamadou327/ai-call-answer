-- Fix: Create a restricted view for public access to business settings
-- This prevents exposure of sensitive fields like notification_email, elevenlabs_voice_id, etc.

-- Create a public view with only the fields needed for public booking
CREATE OR REPLACE VIEW public.public_business_settings
WITH (security_invoker = on) AS
SELECT 
  business_id,
  currency,
  min_booking_notice_hours,
  max_days_advance,
  min_cancellation_notice_hours,
  min_reschedule_notice_hours,
  cancellation_policy,
  primary_language
FROM public.business_settings;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_business_settings TO anon, authenticated;

-- Drop the overly permissive public SELECT policy on business_settings
DROP POLICY IF EXISTS "Public can view business settings for online booking" ON public.business_settings;

-- Create a more restrictive policy that only allows business owners and active staff to view settings
CREATE POLICY "Business owners and staff can view settings"
ON public.business_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_settings.business_id
      AND (
        b.owner_id = auth.uid() 
        OR public.is_staff_member_of_business(auth.uid(), b.id)
      )
  )
);