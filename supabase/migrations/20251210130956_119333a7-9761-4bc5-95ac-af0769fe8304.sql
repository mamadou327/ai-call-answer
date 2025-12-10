-- Create security definer function to check staff membership without recursion
CREATE OR REPLACE FUNCTION public.is_staff_member_of_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_memberships
    WHERE user_id = _user_id
      AND business_id = _business_id
      AND status = 'active'
  )
$$;

-- Create security definer function to get business IDs user is staff of
CREATE OR REPLACE FUNCTION public.get_staff_business_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id
  FROM public.staff_memberships
  WHERE user_id = _user_id
    AND status = 'active'
$$;

-- Drop problematic policies on businesses
DROP POLICY IF EXISTS "Staff can view their business" ON public.businesses;

-- Recreate staff policy using security definer function
CREATE POLICY "Staff can view their business"
ON public.businesses
FOR SELECT
USING (
  public.is_staff_member_of_business(auth.uid(), id)
);

-- Drop and recreate staff_memberships policies that might cause recursion
DROP POLICY IF EXISTS "Staff can view own membership" ON public.staff_memberships;

CREATE POLICY "Staff can view own membership"
ON public.staff_memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Fix bookings policies to use security definer
DROP POLICY IF EXISTS "Staff can view their assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update their assigned bookings" ON public.bookings;

-- Create helper function to check if user can access booking
CREATE OR REPLACE FUNCTION public.can_staff_access_booking(_user_id uuid, _business_id uuid, _staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_memberships sm
    WHERE sm.user_id = _user_id
      AND sm.business_id = _business_id
      AND sm.status = 'active'
      AND (
        _staff_id IS NULL 
        OR sm.linked_staff_id = _staff_id
        OR EXISTS (
          SELECT 1 FROM public.staff s 
          WHERE s.id = _staff_id 
          AND s.email = (SELECT email FROM auth.users WHERE id = _user_id)
        )
      )
  )
$$;

CREATE POLICY "Staff can view their assigned bookings"
ON public.bookings
FOR SELECT
USING (
  public.can_staff_access_booking(auth.uid(), business_id, staff_id)
);

CREATE POLICY "Staff can update their assigned bookings"
ON public.bookings
FOR UPDATE
USING (
  public.can_staff_access_booking(auth.uid(), business_id, staff_id)
)
WITH CHECK (
  public.can_staff_access_booking(auth.uid(), business_id, staff_id)
);

-- Fix services policy
DROP POLICY IF EXISTS "Staff can view their business services" ON public.services;

CREATE POLICY "Staff can view their business services"
ON public.services
FOR SELECT
USING (
  business_id IN (SELECT public.get_staff_business_ids(auth.uid()))
);

-- Fix staff policy
DROP POLICY IF EXISTS "Staff can view business staff" ON public.staff;

CREATE POLICY "Staff can view business staff"
ON public.staff
FOR SELECT
USING (
  business_id IN (SELECT public.get_staff_business_ids(auth.uid()))
);

-- Fix customers policy
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;

CREATE POLICY "Staff can view customers"
ON public.customers
FOR SELECT
USING (
  business_id IN (SELECT public.get_staff_business_ids(auth.uid()))
);

-- Fix messages policies
DROP POLICY IF EXISTS "Staff can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Staff can update their messages" ON public.messages;

CREATE POLICY "Staff can view their own messages"
ON public.messages
FOR SELECT
USING (
  business_id IN (SELECT public.get_staff_business_ids(auth.uid()))
  AND (
    recipient_type = 'all'
    OR (
      recipient_type = 'staff' 
      AND recipient_staff_id IN (
        SELECT linked_staff_id FROM public.staff_memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

CREATE POLICY "Staff can update their messages"
ON public.messages
FOR UPDATE
USING (
  business_id IN (SELECT public.get_staff_business_ids(auth.uid()))
  AND (
    recipient_type = 'all'
    OR (
      recipient_type = 'staff' 
      AND recipient_staff_id IN (
        SELECT linked_staff_id FROM public.staff_memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);