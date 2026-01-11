-- Drop the existing policy and recreate with proper WITH CHECK clause
DROP POLICY IF EXISTS "Business owners can manage their settings" ON business_settings;

CREATE POLICY "Business owners can manage their settings"
ON business_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = business_settings.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'::business_status
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = business_settings.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'::business_status
  )
);