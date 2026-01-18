-- Update public_businesses view to include has_stripe boolean flag
-- This exposes whether Stripe is connected without revealing the account ID

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
  payment_methods,
  -- Expose whether Stripe is connected without revealing the actual ID
  (stripe_account_id IS NOT NULL) AS has_stripe
FROM businesses
WHERE status = 'approved';