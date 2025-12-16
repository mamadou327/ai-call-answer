-- Drop existing policy
DROP POLICY IF EXISTS "Business owners can manage their opening hours" ON public.opening_hours;

-- Recreate with proper WITH CHECK for INSERT
CREATE POLICY "Business owners can manage their opening hours" 
ON public.opening_hours 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = opening_hours.business_id 
    AND businesses.owner_id = auth.uid() 
    AND businesses.status <> 'revoked'::business_status
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = opening_hours.business_id 
    AND businesses.owner_id = auth.uid() 
    AND businesses.status <> 'revoked'::business_status
  )
);