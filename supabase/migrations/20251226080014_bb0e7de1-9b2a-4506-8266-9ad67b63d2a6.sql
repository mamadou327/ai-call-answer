-- Fix RLS infinite recursion and add chair column to staff

-- 1. Add chair column to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS chair text;

-- 2. Fix staff_services policies - remove circular reference to staff table
DROP POLICY IF EXISTS "Business owners can manage staff services" ON public.staff_services;

CREATE POLICY "Business owners can manage staff services"
ON public.staff_services
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.services srv
    JOIN public.businesses b ON b.id = srv.business_id
    WHERE srv.id = staff_services.service_id
      AND b.owner_id = auth.uid()
      AND b.status <> 'revoked'::business_status
  )
);

-- 3. Drop and recreate the staff public policy to fix recursion
DROP POLICY IF EXISTS "Public can view staff for online booking" ON public.staff;

-- Simpler policy that doesn't trigger staff_services RLS
CREATE POLICY "Public can view staff for online booking"
ON public.staff
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = staff.business_id
      AND b.online_booking_enabled = true
      AND b.status = 'approved'::business_status
  )
  AND EXISTS (
    SELECT 1 FROM public.staff_services ss WHERE ss.staff_id = staff.id
  )
);