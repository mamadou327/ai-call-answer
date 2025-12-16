-- Create service_requests table for tracking business service requests
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'sms' or 'email'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Business owners can view and create their own requests
CREATE POLICY "Business owners can view their requests"
  ON public.service_requests
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = service_requests.business_id
    AND businesses.owner_id = auth.uid()
  ));

CREATE POLICY "Business owners can create requests"
  ON public.service_requests
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = service_requests.business_id
    AND businesses.owner_id = auth.uid()
  ));

-- Super admins can view and update all requests
CREATE POLICY "Super admins can view all requests"
  ON public.service_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update requests"
  ON public.service_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Sub admins with approve permission can view and update
CREATE POLICY "Sub admins can view requests"
  ON public.service_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'sub_admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM admin_permissions
      WHERE admin_permissions.user_id = auth.uid()
      AND admin_permissions.can_approve_businesses = true
    )
  );

CREATE POLICY "Sub admins can update requests"
  ON public.service_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'sub_admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM admin_permissions
      WHERE admin_permissions.user_id = auth.uid()
      AND admin_permissions.can_approve_businesses = true
    )
  );