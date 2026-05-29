
-- Add branding columns to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#0F172A',
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS about_description text;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_about_description_length_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_about_description_length_check
  CHECK (about_description IS NULL OR char_length(about_description) <= 500);

-- Rebuild public_businesses view with new columns
CREATE OR REPLACE VIEW public.public_businesses AS
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
  (stripe_account_id IS NOT NULL) AS has_stripe,
  brand_color,
  hero_image_url,
  about_description
FROM businesses
WHERE status = 'approved'::business_status;

GRANT SELECT ON public.public_businesses TO anon, authenticated;

-- Create public storage bucket for hero images
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-hero', 'business-hero', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for business-hero bucket (mirrors business-logos)
DROP POLICY IF EXISTS "Public can view hero images" ON storage.objects;
CREATE POLICY "Public can view hero images"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-hero');

DROP POLICY IF EXISTS "Authenticated users can upload hero images" ON storage.objects;
CREATE POLICY "Authenticated users can upload hero images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-hero' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can update hero images" ON storage.objects;
CREATE POLICY "Authenticated users can update hero images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-hero' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users can delete hero images" ON storage.objects;
CREATE POLICY "Authenticated users can delete hero images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business-hero' AND (storage.foldername(name))[1] = auth.uid()::text);
