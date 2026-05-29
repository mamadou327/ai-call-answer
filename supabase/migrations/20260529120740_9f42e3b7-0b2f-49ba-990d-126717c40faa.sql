
-- 1. Remove the overly-broad realtime policies on messages that override tenant scoping
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime" ON public.messages;

-- 2. Tighten business-logos storage policies so writes only succeed under a business folder owned by the user
DROP POLICY IF EXISTS "Users can upload their own business logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own business logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own business logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete logos" ON storage.objects;

CREATE POLICY "Business owners can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

-- 3. Same hardening for business-gallery
DROP POLICY IF EXISTS "Users can upload their own gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can upload gallery" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update gallery" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete gallery" ON storage.objects;

CREATE POLICY "Business owners can upload gallery"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-gallery'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update gallery"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'business-gallery'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete gallery"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'business-gallery'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
);

-- 4. Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that are only intended to run from triggers
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_booking_slug() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_booking_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_profile() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_super_admin_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_staff_role_on_revoke() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_staff_role_on_membership() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_customer_from_booking() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_staff_membership_to_record() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_slug(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_code(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_staff_join_code(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_super_admin() FROM anon, authenticated, PUBLIC;

-- 5. Revoke EXECUTE from anon on RPCs that only authenticated users should ever call
REVOKE EXECUTE ON FUNCTION public.refresh_staff_join_code_if_expired(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_staff_membership_with_code(text, text, text, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_month_call_count(uuid) FROM anon, PUBLIC;
