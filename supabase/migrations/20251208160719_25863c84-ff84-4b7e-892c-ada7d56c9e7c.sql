-- Add blocking fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason text,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone;

-- Create index for quick lookup of blocked customers by phone
CREATE INDEX IF NOT EXISTS idx_customers_blocked_phone ON public.customers(business_id, phone) WHERE is_blocked = true;