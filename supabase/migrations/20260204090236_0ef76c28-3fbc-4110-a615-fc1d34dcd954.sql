
-- Create a secure view for public staff information (excludes email and phone)
CREATE OR REPLACE VIEW public.public_staff AS
SELECT 
  id,
  business_id,
  name,
  title,
  chair,
  color,
  working_hours,
  ai_enabled
FROM public.staff;

-- Grant access to the view
GRANT SELECT ON public.public_staff TO anon, authenticated;

-- Add comment explaining purpose
COMMENT ON VIEW public.public_staff IS 'Public-facing staff view that excludes sensitive contact information (email, phone). Use this for public booking pages.';
