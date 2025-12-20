-- Add deposit columns to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0.00;

-- Add Stripe Connect columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ;

-- Add deposit settings to business_settings table
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS auto_cancel_unpaid_bookings BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_cancel_hours INTEGER DEFAULT 12;

-- Add deposit tracking columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS deposit_payment_link TEXT;