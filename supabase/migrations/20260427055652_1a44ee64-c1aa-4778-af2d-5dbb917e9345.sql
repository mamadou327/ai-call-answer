-- Enable realtime
ALTER TABLE public.businesses REPLICA IDENTITY FULL;
ALTER TABLE public.business_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Allow super_admin to delete businesses
CREATE POLICY "Super admins can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow sub_admin with approve permission to delete businesses
CREATE POLICY "Sub admins with approve permission can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'sub_admin')
  AND EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.user_id = auth.uid()
      AND ap.can_approve_businesses = true
  )
);
