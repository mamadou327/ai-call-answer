-- Add admin fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS admin_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_request_note text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_requested_at timestamp with time zone DEFAULT NULL;

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  can_approve_businesses boolean DEFAULT false,
  can_view_analytics boolean DEFAULT false,
  can_manage_billing boolean DEFAULT false,
  can_view_calls_messages boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_permissions
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_permissions
CREATE POLICY "Super admins can manage all permissions"
ON public.admin_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view their own permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for admin_permissions updated_at
CREATE TRIGGER update_admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to ensure mlaye915@gmail.com is always super_admin
CREATE OR REPLACE FUNCTION public.ensure_super_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_admin_id uuid;
BEGIN
  -- Find user with email mlaye915@gmail.com
  SELECT id INTO super_admin_id
  FROM auth.users
  WHERE email = 'mlaye915@gmail.com'
  LIMIT 1;

  IF super_admin_id IS NOT NULL THEN
    -- Ensure they have super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (super_admin_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Remove any other roles they might have
    DELETE FROM public.user_roles
    WHERE user_id = super_admin_id
    AND role != 'super_admin';

    -- Ensure their profile has active admin status
    UPDATE public.profiles
    SET admin_status = 'active'
    WHERE user_id = super_admin_id;

    -- Ensure they have full permissions
    INSERT INTO public.admin_permissions (
      user_id, 
      can_approve_businesses, 
      can_view_analytics, 
      can_manage_billing, 
      can_view_calls_messages
    )
    VALUES (super_admin_id, true, true, true, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      can_approve_businesses = true,
      can_view_analytics = true,
      can_manage_billing = true,
      can_view_calls_messages = true;
  END IF;
END;
$$;

-- Update RLS policies for profiles to allow admins to view pending admin profiles
CREATE POLICY "Admins can view admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'sub_admin')
);

CREATE POLICY "Super admins can update admin profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));