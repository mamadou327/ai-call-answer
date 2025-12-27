-- Add tracking fields for custom domain hosting status
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS custom_domain_added_to_hosting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_domain_added_at timestamptz;