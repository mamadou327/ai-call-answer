-- Fix 1: Staff Invites UPDATE policy - Add authentication and email verification
DROP POLICY IF EXISTS "Users can accept invites" ON staff_invites;

CREATE POLICY "Users can accept their own invites"
ON staff_invites FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  status = ANY (ARRAY['accepted', 'expired'])
);

-- Fix 2: Update customers table policies to use 'authenticated' role instead of 'public'
DROP POLICY IF EXISTS "Business owners can manage their customers" ON customers;
DROP POLICY IF EXISTS "Staff can view customers" ON customers;

CREATE POLICY "Business owners can manage their customers"
ON customers FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = customers.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'
));

CREATE POLICY "Staff can view customers"
ON customers FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM staff_memberships sm
  WHERE sm.business_id = customers.business_id
  AND sm.user_id = auth.uid()
  AND sm.status = 'active'
));