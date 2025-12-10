-- Allow super admins to view all staff memberships
CREATE POLICY "Super admins can view all staff memberships"
ON public.staff_memberships
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));