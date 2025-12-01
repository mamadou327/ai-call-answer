-- Secure bookings table - remove any public access
-- Business owners can only see their own bookings
DROP POLICY IF EXISTS "Business owners can manage their bookings" ON public.bookings;

CREATE POLICY "Business owners can view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can insert own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete own bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
);

-- Admins can view all bookings (if they have permission)
CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR
  (
    has_role(auth.uid(), 'sub_admin') AND
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
      AND can_view_analytics = true
    )
  )
);