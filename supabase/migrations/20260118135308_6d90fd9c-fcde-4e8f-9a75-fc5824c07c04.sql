-- Fix PUBLIC_DATA_EXPOSURE: Remove Stripe account fields from public_businesses view
-- These fields expose payment infrastructure details unnecessarily

DROP VIEW IF EXISTS public_businesses;

CREATE VIEW public_businesses WITH (security_invoker=on) AS
SELECT 
  id,
  business_name,
  business_type,
  address,
  main_phone,
  booking_slug,
  online_booking_enabled,
  online_booking_message,
  deposit_collection_timing,
  prepayment_type,
  require_prepayment,
  logo_url,
  website,
  menu_link,
  social_facebook,
  social_instagram,
  social_twitter,
  social_tiktok,
  social_youtube,
  custom_booking_domain,
  custom_domain_verified,
  cuisine_type,
  delivery_enabled,
  delivery_fee,
  delivery_minimum_order,
  delivery_radius_miles,
  minimum_order_amount,
  average_prep_time_minutes,
  payment_methods
FROM businesses
WHERE status = 'approved';