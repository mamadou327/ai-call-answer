-- Allow staff to UPDATE their assigned bookings (status, notes)
CREATE POLICY "Staff can update their assigned bookings"
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = bookings.staff_id
    AND s.email = (SELECT auth.email())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = bookings.staff_id
    AND s.email = (SELECT auth.email())
  )
);

-- Allow staff to update messages (mark as read)
CREATE POLICY "Staff can update their messages"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    JOIN staff s ON s.business_id = sm.business_id
    WHERE sm.business_id = messages.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      messages.recipient_type = 'all'
      OR (messages.recipient_type = 'staff' AND messages.recipient_staff_id = s.id AND s.email = (SELECT auth.email()))
    )
  )
);

-- Add linked_staff_id column to staff_memberships for direct linking
ALTER TABLE public.staff_memberships ADD COLUMN IF NOT EXISTS linked_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Create function to auto-link staff membership to staff record
CREATE OR REPLACE FUNCTION public.link_staff_membership_to_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_user_email text;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = NEW.user_id;
  
  -- Try to find matching staff record by email first
  SELECT id INTO v_staff_id
  FROM staff
  WHERE business_id = NEW.business_id
  AND (
    email = v_user_email
    OR lower(name) = lower(trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')))
  )
  LIMIT 1;
  
  IF v_staff_id IS NOT NULL THEN
    NEW.linked_staff_id := v_staff_id;
    
    -- Also update the staff record email if not set
    UPDATE staff 
    SET email = v_user_email 
    WHERE id = v_staff_id AND (email IS NULL OR email = '');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-link on insert and update
DROP TRIGGER IF EXISTS auto_link_staff_membership ON public.staff_memberships;
CREATE TRIGGER auto_link_staff_membership
BEFORE INSERT OR UPDATE ON public.staff_memberships
FOR EACH ROW
EXECUTE FUNCTION public.link_staff_membership_to_record();

-- Also run auto-link for existing memberships
UPDATE staff_memberships sm
SET linked_staff_id = (
  SELECT s.id FROM staff s
  JOIN auth.users u ON u.id = sm.user_id
  WHERE s.business_id = sm.business_id
  AND (
    s.email = u.email
    OR lower(s.name) = lower(trim(COALESCE(sm.first_name, '') || ' ' || COALESCE(sm.last_name, '')))
  )
  LIMIT 1
)
WHERE linked_staff_id IS NULL;