
-- Public read for menu_item_sizes (mirror menu_item_options policy)
CREATE POLICY "Public can view menu item sizes for online booking"
ON public.menu_item_sizes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.menu_items mi
    JOIN public.businesses b ON b.id = mi.business_id
    WHERE mi.id = menu_item_sizes.menu_item_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
);

GRANT SELECT ON public.menu_item_sizes TO anon;

-- Staff can view their own staff_accounts row
CREATE POLICY "Staff can view their own staff_account"
ON public.staff_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
