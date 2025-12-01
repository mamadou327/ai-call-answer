-- Add number assignment and porting fields to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS assigned_aivia_number text,
ADD COLUMN IF NOT EXISTS number_notes text,
ADD COLUMN IF NOT EXISTS porting_status text CHECK (porting_status IN ('pending', 'in_progress', 'complete')),
ADD COLUMN IF NOT EXISTS porting_instructions text;

-- Add can_manage_business_numbers permission to admin_permissions
ALTER TABLE public.admin_permissions
ADD COLUMN IF NOT EXISTS can_manage_business_numbers boolean DEFAULT false;

-- Update super admin to have all permissions
UPDATE public.admin_permissions
SET 
  can_approve_businesses = true,
  can_manage_business_numbers = true,
  can_view_analytics = true,
  can_manage_billing = true,
  can_view_calls_messages = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'mlaye915@gmail.com'
);

-- Create index on business status for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON public.businesses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);