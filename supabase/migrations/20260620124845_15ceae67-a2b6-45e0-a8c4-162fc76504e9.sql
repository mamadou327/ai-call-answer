CREATE OR REPLACE FUNCTION public.get_business_summary_for_staff(_business_id uuid)
RETURNS TABLE(id uuid, business_name text, business_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.business_name, b.business_type
  FROM public.businesses b
  WHERE b.id = _business_id
    AND EXISTS (
      SELECT 1 FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.business_id = _business_id
    );
$$;