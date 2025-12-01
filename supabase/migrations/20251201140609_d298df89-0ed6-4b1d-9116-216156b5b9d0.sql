-- Add plan_tier to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'tier_1' CHECK (plan_tier IN ('tier_1', 'tier_2', 'tier_3'));