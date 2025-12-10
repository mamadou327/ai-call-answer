-- Drop the complex policy and create a simpler one
DROP POLICY IF EXISTS "Staff can view their assigned bookings" ON public.bookings;

-- Simpler policy: Staff can view bookings for their business where they are assigned
CREATE POLICY "Staff can view their assigned bookings"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
  AND (
    -- Either booking is assigned to a staff member with matching email
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = bookings.staff_id
      AND s.email = (SELECT auth.email())
    )
    OR
    -- Or booking has no staff assigned yet (can see unassigned)
    bookings.staff_id IS NULL
  )
);