-- Remove TrueLayer columns from businesses table
ALTER TABLE public.businesses DROP COLUMN IF EXISTS truelayer_client_id;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS truelayer_client_secret;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS truelayer_connected_at;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS preferred_payment_provider;