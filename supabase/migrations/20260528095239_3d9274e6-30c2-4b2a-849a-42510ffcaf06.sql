
-- 1. Switch public views to security definer mode so they don't depend on base-table anon policies
ALTER VIEW public.public_businesses SET (security_invoker = off);
ALTER VIEW public.public_staff SET (security_invoker = off);
ALTER VIEW public.public_business_settings SET (security_invoker = off);

GRANT SELECT ON public.public_businesses TO anon, authenticated;
GRANT SELECT ON public.public_staff TO anon, authenticated;
GRANT SELECT ON public.public_business_settings TO anon, authenticated;

-- 2. Remove anonymous branch from businesses public policy
DROP POLICY IF EXISTS "Public can view limited business info" ON public.businesses;
CREATE POLICY "Owners, staff and admins can view business"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  ((auth.uid() = owner_id) AND (status <> 'revoked'::business_status))
  OR is_staff_member_of_business(auth.uid(), id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'sub_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM admin_permissions
      WHERE admin_permissions.user_id = auth.uid()
        AND admin_permissions.can_approve_businesses = true
    )
  )
);

-- 3. Drop anonymous public read on staff table (public_staff view covers public access)
DROP POLICY IF EXISTS "Anyone can view staff for online booking" ON public.staff;

-- 4. Fix menu-images storage policies: require path[1] = business_id owned by current user
DROP POLICY IF EXISTS "Business owners can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete menu images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can upload menu images" ON storage.objects;

CREATE POLICY "Business owners can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

-- 5. demo-audio: restrict writes to super_admin
DROP POLICY IF EXISTS "Authenticated users can upload demo audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update demo audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete demo audio" ON storage.objects;

CREATE POLICY "Super admins can upload demo audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'demo-audio' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update demo audio"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'demo-audio' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete demo audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'demo-audio' AND has_role(auth.uid(), 'super_admin'::app_role));

-- 6. Scope menu_item_option_sizes public read
DROP POLICY IF EXISTS "Option sizes are viewable by everyone" ON public.menu_item_option_sizes;

CREATE POLICY "Public can view option sizes for online booking"
ON public.menu_item_option_sizes FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM menu_item_options o
    JOIN menu_item_option_groups g ON o.option_group_id = g.id
    JOIN menu_items mi ON g.menu_item_id = mi.id
    JOIN businesses b ON mi.business_id = b.id
    WHERE o.id = menu_item_option_sizes.option_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
);

-- 7. Revoke EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.ensure_super_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_staff_role_on_membership() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_code(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_slug(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_staff_join_code(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_staff_membership_to_record() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_super_admin_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_profile() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_staff_role_on_revoke() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_booking_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_booking_slug() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_customer_from_booking() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- 8. Realtime authorization: require authentication to subscribe to any channel
-- (postgres_changes still respect underlying table RLS; this blocks anonymous broadcast/presence subscriptions)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (true);
