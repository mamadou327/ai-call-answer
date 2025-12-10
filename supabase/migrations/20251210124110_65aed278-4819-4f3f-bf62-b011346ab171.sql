-- Drop and recreate policies using linked_staff_id for better matching
DROP POLICY IF EXISTS "Staff can view their assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update their assigned bookings" ON public.bookings;

-- Staff can view bookings assigned to their linked staff record OR unassigned
CREATE POLICY "Staff can view their assigned bookings"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      bookings.staff_id = sm.linked_staff_id
      OR bookings.staff_id IS NULL
      OR EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = bookings.staff_id
        AND s.email = (SELECT auth.email())
      )
    )
  )
);

-- Staff can UPDATE their own assigned bookings
CREATE POLICY "Staff can update their assigned bookings"
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      bookings.staff_id = sm.linked_staff_id
      OR EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = bookings.staff_id
        AND s.email = (SELECT auth.email())
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    WHERE sm.business_id = bookings.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      bookings.staff_id = sm.linked_staff_id
      OR EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = bookings.staff_id
        AND s.email = (SELECT auth.email())
      )
    )
  )
);