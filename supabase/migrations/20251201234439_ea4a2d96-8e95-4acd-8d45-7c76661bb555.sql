-- Update RLS policies for businesses table to block revoked businesses
DROP POLICY IF EXISTS "Owners view own business" ON businesses;
DROP POLICY IF EXISTS "Owners update own business" ON businesses;
DROP POLICY IF EXISTS "Owners insert own business" ON businesses;

-- Recreate policies with revoked check
CREATE POLICY "Owners view own business"
ON businesses
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id AND status != 'revoked');

CREATE POLICY "Owners insert own business"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own business"
ON businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id AND status != 'revoked')
WITH CHECK (auth.uid() = owner_id AND status != 'revoked');

-- Update RLS policies for related tables to respect revoked status
DROP POLICY IF EXISTS "Business owners can manage their services" ON services;
CREATE POLICY "Business owners can manage their services"
ON services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = services.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can manage their staff" ON staff;
CREATE POLICY "Business owners can manage their staff"
ON staff
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can manage their opening hours" ON opening_hours;
CREATE POLICY "Business owners can manage their opening hours"
ON opening_hours
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = opening_hours.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can manage their settings" ON business_settings;
CREATE POLICY "Business owners can manage their settings"
ON business_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = business_settings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Business owners can insert own bookings" ON bookings;
DROP POLICY IF EXISTS "Business owners can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Business owners can delete own bookings" ON bookings;

CREATE POLICY "Business owners can view own bookings"
ON bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = bookings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can insert own bookings"
ON bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = bookings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can update own bookings"
ON bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = bookings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = bookings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can delete own bookings"
ON bookings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = bookings.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can view their calls" ON calls_log;
DROP POLICY IF EXISTS "Business owners can insert calls" ON calls_log;

CREATE POLICY "Business owners can view their calls"
ON calls_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = calls_log.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can insert calls"
ON calls_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = calls_log.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

DROP POLICY IF EXISTS "Business owners can view their staff accounts" ON staff_accounts;
DROP POLICY IF EXISTS "Business owners can insert staff accounts" ON staff_accounts;
DROP POLICY IF EXISTS "Business owners can update their staff accounts" ON staff_accounts;
DROP POLICY IF EXISTS "Business owners can delete their staff accounts" ON staff_accounts;

CREATE POLICY "Business owners can view their staff accounts"
ON staff_accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff_accounts.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can insert staff accounts"
ON staff_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff_accounts.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can update their staff accounts"
ON staff_accounts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff_accounts.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

CREATE POLICY "Business owners can delete their staff accounts"
ON staff_accounts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff_accounts.business_id 
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);