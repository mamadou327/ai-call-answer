-- Fix 1: Remove overly permissive staff_invites SELECT policy
DROP POLICY IF EXISTS "Users can view invites by token" ON public.staff_invites;

-- Create a secure function to validate invite tokens without exposing the entire table
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  email text,
  role text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, business_id, email, role, status
  FROM public.staff_invites
  WHERE invite_token = p_token
    AND status = 'pending'
  LIMIT 1;
$$;

-- Fix 2: Remove overly permissive staff_memberships INSERT policy
DROP POLICY IF EXISTS "Allow staff membership creation" ON public.staff_memberships;

-- Create a secure function to validate join codes and create memberships
CREATE OR REPLACE FUNCTION public.create_staff_membership_with_code(
  p_join_code text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_chair text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_user_id uuid;
  v_membership_id uuid;
  v_existing_membership uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate join code and get business_id
  SELECT b.id INTO v_business_id
  FROM businesses b
  WHERE b.staff_join_code = upper(trim(p_join_code))
    AND b.staff_join_expires_at > now()
    AND b.status = 'approved';

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired join code';
  END IF;

  -- Check for existing membership
  SELECT id INTO v_existing_membership
  FROM staff_memberships
  WHERE user_id = v_user_id AND business_id = v_business_id;

  IF v_existing_membership IS NOT NULL THEN
    -- Update existing revoked membership to pending
    UPDATE staff_memberships
    SET status = 'pending_approval',
        first_name = p_first_name,
        last_name = p_last_name,
        phone = p_phone,
        position = p_position,
        chair = p_chair,
        revoked_at = NULL
    WHERE id = v_existing_membership
    RETURNING id INTO v_membership_id;
  ELSE
    -- Create new membership
    INSERT INTO staff_memberships (
      user_id, business_id, first_name, last_name, phone, position, chair, status, role
    ) VALUES (
      v_user_id, v_business_id, p_first_name, p_last_name, p_phone, p_position, p_chair, 'pending_approval', 'staff'
    )
    RETURNING id INTO v_membership_id;
  END IF;

  RETURN v_membership_id;
END;
$$;

-- Add policy allowing users to insert their OWN membership only (as fallback)
CREATE POLICY "Users can create own membership via RPC"
ON public.staff_memberships
FOR INSERT
WITH CHECK (auth.uid() = user_id);