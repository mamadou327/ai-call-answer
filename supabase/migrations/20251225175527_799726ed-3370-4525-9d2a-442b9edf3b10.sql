-- Add logo and social media columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS social_instagram text,
ADD COLUMN IF NOT EXISTS social_facebook text,
ADD COLUMN IF NOT EXISTS social_tiktok text,
ADD COLUMN IF NOT EXISTS social_twitter text,
ADD COLUMN IF NOT EXISTS social_youtube text;

-- Create category type enum for services
DO $$ BEGIN
  CREATE TYPE service_category_type AS ENUM ('kids', 'women', 'men', 'unisex', 'hairstyle', 'color', 'treatment', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add category_type column to services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS category_type service_category_type DEFAULT 'other';

-- Create business_gallery table
CREATE TABLE IF NOT EXISTS public.business_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on business_gallery
ALTER TABLE public.business_gallery ENABLE ROW LEVEL SECURITY;

-- RLS policies for business_gallery
CREATE POLICY "Business owners can manage their gallery"
ON public.business_gallery
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = business_gallery.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Public can view gallery for online booking enabled businesses"
ON public.business_gallery
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = business_gallery.business_id
  AND businesses.online_booking_enabled = true
  AND businesses.status = 'approved'::business_status
));

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for business gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-gallery', 'business-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for business-logos bucket
CREATE POLICY "Business owners can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Business owners can update their logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Business owners can delete their logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'business-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');

-- Storage policies for business-gallery bucket
CREATE POLICY "Business owners can upload gallery images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'business-gallery' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Business owners can update their gallery images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'business-gallery' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Business owners can delete their gallery images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'business-gallery' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view gallery images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-gallery');