-- Fix the view to use SECURITY INVOKER (default) to enforce RLS of the querying user
DROP VIEW IF EXISTS public.public_businesses;

CREATE VIEW public.public_businesses 
WITH (security_invoker = true)
AS
SELECT 
  id,
  business_name,
  business_type,
  address,
  main_phone,
  website,
  booking_slug,
  logo_url,
  online_booking_enabled,
  online_booking_message,
  status,
  cuisine_type,
  minimum_order_amount,
  delivery_enabled,
  delivery_fee,
  delivery_minimum_order,
  delivery_radius_miles,
  average_prep_time_minutes,
  deposit_collection_timing,
  stripe_account_id,
  stripe_connected_at,
  social_instagram,
  social_facebook,
  social_tiktok,
  social_twitter,
  social_youtube,
  custom_booking_domain,
  custom_domain_verified,
  require_prepayment,
  prepayment_type,
  refund_policy,
  refund_window_hours,
  payment_methods,
  menu_link
FROM businesses
WHERE online_booking_enabled = true 
  AND status = 'approved';

-- Grant access to the view for public and authenticated users
GRANT SELECT ON public.public_businesses TO anon, authenticated;