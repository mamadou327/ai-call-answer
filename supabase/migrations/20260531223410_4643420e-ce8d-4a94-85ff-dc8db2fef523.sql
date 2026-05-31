
-- Fix demo_requests: remove profiles.admin_status escalation path
DROP POLICY IF EXISTS "Admins can view demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Admins can update demo requests" ON public.demo_requests;

CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update demo requests"
ON public.demo_requests
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix realtime.messages: drop overly-permissive USING(true)/WITH CHECK(true)
-- The app uses postgres_changes (which relies on underlying table RLS) so broadcast/presence policies
-- being absent does not affect existing functionality.
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;

-- Fix storage: drop weaker folder=auth.uid() policies for business-logos and business-gallery.
-- Stronger policies that join to public.businesses remain.
DROP POLICY IF EXISTS "Business owners can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update their gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete their gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete their logos" ON storage.objects;
