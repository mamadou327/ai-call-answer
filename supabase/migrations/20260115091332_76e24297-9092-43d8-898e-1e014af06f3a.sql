-- Drop old SELECT policy and create a corrected one
DROP POLICY IF EXISTS "Admins can view demo requests" ON public.demo_requests;

CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.admin_status IN ('approved', 'active')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin')
  )
);

-- Also fix the UPDATE policy
DROP POLICY IF EXISTS "Admins can update demo requests" ON public.demo_requests;

CREATE POLICY "Admins can update demo requests"
ON public.demo_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.admin_status IN ('approved', 'active')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin')
  )
);