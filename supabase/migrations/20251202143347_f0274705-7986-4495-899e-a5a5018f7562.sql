-- Add staff join code fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS staff_join_code text,
ADD COLUMN IF NOT EXISTS staff_join_expires_at timestamp with time zone;

-- Add booking attribution fields
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS last_modified_by_user_id uuid,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- Create staff_memberships table
CREATE TABLE IF NOT EXISTS public.staff_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  status text NOT NULL DEFAULT 'pending_approval',
  created_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  revoked_at timestamp with time zone,
  UNIQUE(business_id, user_id)
);

-- Enable RLS on staff_memberships
ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;

-- Business owners can manage their staff memberships
CREATE POLICY "Business owners can view their staff memberships"
ON public.staff_memberships
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = staff_memberships.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'::business_status
  )
);

CREATE POLICY "Business owners can update their staff memberships"
ON public.staff_memberships
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = staff_memberships.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'::business_status
  )
);

CREATE POLICY "Business owners can delete their staff memberships"
ON public.staff_memberships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = staff_memberships.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'::business_status
  )
);

-- Allow staff to view their own membership
CREATE POLICY "Staff can view own membership"
ON public.staff_memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Allow inserting staff memberships (for signup flow)
CREATE POLICY "Allow staff membership creation"
ON public.staff_memberships
FOR INSERT
WITH CHECK (true);

-- Create function to generate staff join code
CREATE OR REPLACE FUNCTION public.generate_staff_join_code(business_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_name text;
  prefix text;
  random_digits text;
BEGIN
  -- Remove non-alphanumeric and lowercase
  cleaned_name := lower(regexp_replace(business_name, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Take first 4 chars (or less if shorter) and uppercase
  prefix := upper(substring(cleaned_name from 1 for 4));
  
  -- Pad with X if less than 4 chars
  WHILE length(prefix) < 4 LOOP
    prefix := prefix || 'X';
  END LOOP;
  
  -- Generate 4 random digits
  random_digits := lpad(floor(random() * 10000)::text, 4, '0');
  
  RETURN prefix || '-' || random_digits;
END;
$$;

-- Create function to check and refresh join code
CREATE OR REPLACE FUNCTION public.refresh_staff_join_code_if_expired(p_business_id uuid)
RETURNS TABLE(join_code text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name text;
  v_current_code text;
  v_current_expires timestamp with time zone;
  v_new_code text;
  v_new_expires timestamp with time zone;
BEGIN
  -- Get current business info
  SELECT business_name, staff_join_code, staff_join_expires_at
  INTO v_business_name, v_current_code, v_current_expires
  FROM businesses
  WHERE id = p_business_id;
  
  -- If code doesn't exist or is expired, generate new one
  IF v_current_code IS NULL OR v_current_expires IS NULL OR v_current_expires < now() THEN
    v_new_code := generate_staff_join_code(v_business_name);
    v_new_expires := now() + interval '24 hours';
    
    UPDATE businesses
    SET staff_join_code = v_new_code,
        staff_join_expires_at = v_new_expires
    WHERE id = p_business_id;
    
    RETURN QUERY SELECT v_new_code, v_new_expires;
  ELSE
    RETURN QUERY SELECT v_current_code, v_current_expires;
  END IF;
END;
$$;

-- Create function to validate join code (public access for signup)
CREATE OR REPLACE FUNCTION public.validate_staff_join_code(p_code text)
RETURNS TABLE(business_id uuid, business_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.business_name
  FROM businesses b
  WHERE b.staff_join_code = upper(trim(p_code))
    AND b.staff_join_expires_at > now()
    AND b.status = 'approved'::business_status;
END;
$$;

-- Policy for reading join code (business owners only)
CREATE POLICY "Business owners can read join code"
ON public.businesses
FOR SELECT
USING (
  auth.uid() = owner_id 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);