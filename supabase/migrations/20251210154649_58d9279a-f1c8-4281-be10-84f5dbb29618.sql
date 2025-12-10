-- Create function to auto-assign staff role
CREATE OR REPLACE FUNCTION public.assign_staff_role_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When membership is active/approved, add staff role
  IF NEW.status = 'active' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for insert and update on staff_memberships
CREATE TRIGGER on_staff_membership_active
  AFTER INSERT OR UPDATE OF status ON public.staff_memberships
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.assign_staff_role_on_membership();