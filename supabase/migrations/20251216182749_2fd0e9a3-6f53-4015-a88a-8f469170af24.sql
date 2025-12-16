-- Add column to track reminder sent
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp with time zone;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending 
ON public.bookings (business_id, start_time) 
WHERE status = 'confirmed' AND reminder_sent_at IS NULL;