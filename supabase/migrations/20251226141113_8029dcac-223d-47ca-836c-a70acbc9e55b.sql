-- Add TrueLayer payment provider columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS truelayer_client_id TEXT,
ADD COLUMN IF NOT EXISTS truelayer_client_secret TEXT,
ADD COLUMN IF NOT EXISTS truelayer_connected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferred_payment_provider TEXT DEFAULT 'stripe';