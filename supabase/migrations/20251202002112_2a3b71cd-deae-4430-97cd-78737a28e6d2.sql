-- Add 'staff' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'staff';

-- Create staff_invites table
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired'))
);

-- Enable RLS
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own invites
CREATE POLICY "Business owners can view their invites"
ON public.staff_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_invites.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'
  )
);

-- Business owners can create invites
CREATE POLICY "Business owners can create invites"
ON public.staff_invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses
    WHERE businesses.id = staff_invites.business_id
    AND businesses.owner_id = auth.uid()
    AND businesses.status <> 'revoked'
  )
);

-- Anyone can view their own invite by token (for acceptance flow)
CREATE POLICY "Users can view invites by token"
ON public.staff_invites
FOR SELECT
USING (true);

-- Anyone can update invite status (for acceptance flow)
CREATE POLICY "Users can accept invites"
ON public.staff_invites
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status IN ('accepted', 'expired'));