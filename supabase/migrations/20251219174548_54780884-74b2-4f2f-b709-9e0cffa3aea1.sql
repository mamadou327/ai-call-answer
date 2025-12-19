ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS min_reschedule_notice_hours integer DEFAULT 24;