-- Add created_by field to bookings table to track who created the booking
ALTER TABLE public.bookings 
ADD COLUMN created_by TEXT DEFAULT 'system';

-- Add created_by_user_id to link to the user who created it (if applicable)
ALTER TABLE public.bookings 
ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);

-- Enable realtime for bookings table
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- Add index for created_by field (created_at index already exists)
CREATE INDEX idx_bookings_created_by ON public.bookings(created_by);