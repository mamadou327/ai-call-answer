-- Add custom domain verification fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS custom_domain_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at timestamptz,
ADD COLUMN IF NOT EXISTS custom_domain_status_message text;