-- Allow staff to view their business via staff_memberships
CREATE POLICY "Staff can view their business"
ON public.businesses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = businesses.id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
);

-- Allow staff to view bookings assigned to them
CREATE POLICY "Staff can view their assigned bookings"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    JOIN staff s ON s.business_id = sm.business_id
    WHERE sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      -- Staff can see their own assigned bookings
      (s.email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND bookings.staff_id = s.id)
      OR
      -- Or match by name from membership
      (s.name = CONCAT(sm.first_name, ' ', sm.last_name) AND bookings.staff_id = s.id)
    )
    AND bookings.business_id = sm.business_id
  )
);

-- Allow staff to view services for their business
CREATE POLICY "Staff can view their business services"
ON public.services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = services.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
);

-- Allow staff to view staff records for their business
CREATE POLICY "Staff can view business staff"
ON public.staff
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = staff.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
);