-- Allow admins to view all bookings for analytics
CREATE POLICY "Super admins can view all bookings"
ON public.bookings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sub admins with analytics can view bookings"
ON public.bookings
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_view_analytics = true
  )
);

-- Allow admins to view all services for revenue calculation
CREATE POLICY "Super admins can view all services"
ON public.services
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sub admins with analytics can view services"
ON public.services
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_view_analytics = true
  )
);

-- Allow admins to view all staff for analytics
CREATE POLICY "Super admins can view all staff"
ON public.staff
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sub admins with analytics can view staff"
ON public.staff
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_view_analytics = true
  )
);

-- Allow admins to view all calls for analytics
CREATE POLICY "Super admins can view all calls"
ON public.calls_log
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sub admins with analytics can view calls"
ON public.calls_log
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_view_analytics = true
  )
);

-- Allow admins to view all messages for analytics
CREATE POLICY "Super admins can view all messages"
ON public.messages
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sub admins with analytics can view messages"
ON public.messages
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_view_analytics = true
  )
);