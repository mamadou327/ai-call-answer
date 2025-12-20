-- Drop the existing business owner policy for recordings (if exists)
DROP POLICY IF EXISTS "Business owners can view their recordings" ON storage.objects;

-- Create admin-only policy for viewing recordings
CREATE POLICY "Admins can view all recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'sub_admin'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.admin_permissions
        WHERE admin_permissions.user_id = auth.uid()
        AND admin_permissions.can_view_calls_messages = true
      )
    )
  )
);