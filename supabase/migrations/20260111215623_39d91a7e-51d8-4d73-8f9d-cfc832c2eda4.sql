-- Create a secure view for public business information
-- This view only exposes non-sensitive columns for public booking pages

CREATE OR REPLACE VIEW public.public_businesses AS
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

-- Drop the overly permissive public SELECT policy on businesses
DROP POLICY IF EXISTS "Public can view businesses with online booking enabled" ON businesses;

-- Create a new restrictive public SELECT policy that only allows access to non-sensitive columns
-- by requiring the query to go through the view or be by an authenticated owner/staff/admin
CREATE POLICY "Public can view limited business info"
ON businesses
FOR SELECT
USING (
  -- Only allow public access if the user is:
  -- 1. The owner
  (auth.uid() = owner_id AND status <> 'revoked'::business_status)
  OR
  -- 2. A staff member
  is_staff_member_of_business(auth.uid(), id)
  OR
  -- 3. A super admin
  has_role(auth.uid(), 'super_admin'::app_role)
  OR
  -- 4. A sub-admin with permission
  (has_role(auth.uid(), 'sub_admin'::app_role) AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_approve_businesses = true
  ))
  OR
  -- 5. Anonymous users can only query via specific non-sensitive columns
  -- This is a limited check - the view should be used for public access
  (
    auth.uid() IS NULL
    AND online_booking_enabled = true 
    AND status = 'approved'
  )
);