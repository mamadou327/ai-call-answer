-- Add email and phone to staff table
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text;

-- Add localization fields to business_settings  
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS country text DEFAULT 'United Kingdom',
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GBP',
ADD COLUMN IF NOT EXISTS app_language text DEFAULT 'English';

-- Create staff_services junction table
CREATE TABLE IF NOT EXISTS public.staff_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  service_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE,
  CONSTRAINT staff_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE,
  CONSTRAINT staff_services_unique UNIQUE(staff_id, service_id)
);

-- Enable RLS
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;