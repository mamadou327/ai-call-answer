-- Create function to remove staff role when membership is revoked
CREATE OR REPLACE FUNCTION public.remove_staff_role_on_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only remove if user has no other active memberships
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_memberships
    WHERE user_id = OLD.user_id
      AND status = 'active'
      AND id != OLD.id
  ) THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id AND role = 'staff';
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger for when membership is revoked (status update)
CREATE TRIGGER on_staff_membership_revoked
  AFTER UPDATE OF status ON public.staff_memberships
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status IN ('revoked', 'pending_approval'))
  EXECUTE FUNCTION public.remove_staff_role_on_revoke();

-- Trigger for when membership is deleted
CREATE TRIGGER on_staff_membership_deleted
  AFTER DELETE ON public.staff_memberships
  FOR EACH ROW
  WHEN (OLD.status = 'active')
  EXECUTE FUNCTION public.remove_staff_role_on_revoke();