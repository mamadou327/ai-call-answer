-- Secure businesses table - ensure no public access
-- Keep existing admin policies but ensure they're explicit
DROP POLICY IF EXISTS "Business owners can view their own business" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can update their own business" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can insert their own business" ON public.businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can update all businesses" ON public.businesses;

-- Business owners can only view their own business
CREATE POLICY "Owners view own business"
ON public.businesses
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

-- Business owners can insert their own business
CREATE POLICY "Owners insert own business"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Business owners can update their own business
CREATE POLICY "Owners update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Super admins can view all businesses
CREATE POLICY "Super admins view all businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Sub-admins with approval permission can view businesses
CREATE POLICY "Approved sub-admins view businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sub_admin') AND
  EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = auth.uid()
    AND can_approve_businesses = true
  )
);

-- Super admins can update all businesses (for approval/rejection)
CREATE POLICY "Super admins update businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Sub-admins with approval permission can update business status
CREATE POLICY "Approved sub-admins update businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'sub_admin') AND
  EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = auth.uid()
    AND can_approve_businesses = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sub_admin') AND
  EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = auth.uid()
    AND can_approve_businesses = true
  )
);