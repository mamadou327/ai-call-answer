-- Add TXT record value field for admin to communicate with business owners
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS custom_domain_txt_value text;