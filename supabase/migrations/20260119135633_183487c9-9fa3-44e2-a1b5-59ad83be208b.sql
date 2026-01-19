-- Add new call type enum values for orders and reservations
ALTER TYPE public.call_type ADD VALUE IF NOT EXISTS 'new_order';
ALTER TYPE public.call_type ADD VALUE IF NOT EXISTS 'new_reservation';
ALTER TYPE public.call_type ADD VALUE IF NOT EXISTS 'cancel_order';