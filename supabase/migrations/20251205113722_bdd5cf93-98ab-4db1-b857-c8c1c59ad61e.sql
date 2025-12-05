-- Create a secure RPC function to check for pending invites by email
-- This allows new users to safely check for invites matching their email without exposing the entire table
CREATE OR REPLACE FUNCTION public.get_pending_invite_for_email(p_email text)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  business_name text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT si.id, si.business_id, b.business_name, si.role
  FROM public.staff_invites si
  JOIN public.businesses b ON b.id = si.business_id
  WHERE si.email = lower(trim(p_email))
    AND si.status = 'pending'
  LIMIT 1;
$$;