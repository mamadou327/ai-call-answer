-- Allow business owners to view profiles of their staff members
CREATE POLICY "Business owners can view staff profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.staff_memberships sm
    JOIN public.businesses b ON b.id = sm.business_id
    WHERE sm.user_id = profiles.user_id
      AND b.owner_id = auth.uid()
      AND b.status <> 'revoked'::business_status
  )
);