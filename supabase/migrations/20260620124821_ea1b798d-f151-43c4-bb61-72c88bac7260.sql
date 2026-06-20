-- 1. Fix call-recordings storage INSERT to service_role only
DROP POLICY IF EXISTS "Service role can upload recordings" ON storage.objects;
CREATE POLICY "Service role can upload recordings"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'call-recordings');

-- 2. Remove staff branch from broad business SELECT policy
DROP POLICY IF EXISTS "Staff can view their business" ON public.businesses;
DROP POLICY IF EXISTS "Owners, staff and admins can view business" ON public.businesses;

CREATE POLICY "Owners and admins can view business"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  ((auth.uid() = owner_id) AND (status <> 'revoked'::business_status))
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'sub_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE admin_permissions.user_id = auth.uid()
        AND admin_permissions.can_approve_businesses = true
    )
  )
);

-- 3. Safe RPC for staff to read minimal business info (name + type only)
CREATE OR REPLACE FUNCTION public.get_business_summary_for_staff(_business_id uuid)
RETURNS TABLE(id uuid, business_name text, business_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.business_name, b.business_type
  FROM public.businesses b
  WHERE b.id = _business_id
    AND public.is_staff_member_of_business(auth.uid(), _business_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_business_summary_for_staff(uuid) TO authenticated;