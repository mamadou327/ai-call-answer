-- Add RLS policies for staff_services table
CREATE POLICY "Business owners can manage staff services"
ON staff_services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    JOIN businesses ON businesses.id = staff.business_id
    WHERE staff.id = staff_services.staff_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);

-- Add RLS policies for staff_time_off table
CREATE POLICY "Business owners can manage time off"
ON staff_time_off
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = staff_time_off.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status != 'revoked'
  )
);