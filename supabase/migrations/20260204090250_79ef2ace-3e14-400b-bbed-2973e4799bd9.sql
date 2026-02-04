
-- Drop and recreate the view with SECURITY INVOKER (default, not SECURITY DEFINER)
DROP VIEW IF EXISTS public.public_staff;

CREATE VIEW public.public_staff 
WITH (security_invoker = true)
AS
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
