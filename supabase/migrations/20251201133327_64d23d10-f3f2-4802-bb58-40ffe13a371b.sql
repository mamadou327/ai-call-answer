-- Ensure the super admin protection with separate functions for each table

-- Function to protect super admin role
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is the super admin user, ensure correct role
  IF (SELECT email FROM auth.users WHERE id = NEW.user_id) = 'mlaye915@gmail.com' THEN
    IF NEW.role != 'super_admin' THEN
      NEW.role = 'super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to protect super admin profile status
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is the super admin user, ensure active status
  IF (SELECT email FROM auth.users WHERE id = NEW.user_id) = 'mlaye915@gmail.com' THEN
    IF NEW.admin_status IS DISTINCT FROM 'active' THEN
      NEW.admin_status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Add trigger to user_roles to protect super admin role
DROP TRIGGER IF EXISTS protect_super_admin_role_trigger ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_role();

-- Add trigger to profiles to protect super admin status
DROP TRIGGER IF EXISTS protect_super_admin_profile_trigger ON public.profiles;
CREATE TRIGGER protect_super_admin_profile_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_profile();

-- Prevent deletion of super admin role
CREATE OR REPLACE FUNCTION public.prevent_super_admin_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = OLD.user_id) = 'mlaye915@gmail.com' THEN
    RAISE EXCEPTION 'Cannot delete the super admin role';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_super_admin_role_delete ON public.user_roles;
CREATE TRIGGER prevent_super_admin_role_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_delete();

-- Run ensure_super_admin function to set up initial state
SELECT ensure_super_admin();