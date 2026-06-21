
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_name text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_tier text,
  requested_tier text NOT NULL,
  contact_email text,
  feature_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upgrade_requests TO authenticated;
GRANT ALL ON public.upgrade_requests TO service_role;

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all upgrade requests"
  ON public.upgrade_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update upgrade requests"
  ON public.upgrade_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete upgrade requests"
  ON public.upgrade_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Business owners can create their own upgrade requests"
  ON public.upgrade_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view their own upgrade requests"
  ON public.upgrade_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

CREATE TRIGGER upgrade_requests_set_updated_at
BEFORE UPDATE ON public.upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
