-- Add RLS policies for staff_accounts table
-- Business owners can manage staff accounts for their businesses
CREATE POLICY "Business owners can view their staff accounts"
ON public.staff_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_accounts.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can insert staff accounts"
ON public.staff_accounts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_accounts.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update their staff accounts"
ON public.staff_accounts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_accounts.business_id
    AND businesses.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete their staff accounts"
ON public.staff_accounts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_accounts.business_id
    AND businesses.owner_id = auth.uid()
  )
);