-- Allow admins to view business_settings so the admin dashboard can see the tier customers chose at signup
CREATE POLICY "Super admins can view all business settings"
ON public.business_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Approved sub admins can view business settings"
ON public.business_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sub_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
      AND admin_permissions.can_approve_businesses = true
  )
);