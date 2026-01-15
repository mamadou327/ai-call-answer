-- Create demo_requests table for public demo request submissions
CREATE TABLE public.demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business_name TEXT,
  business_type TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Allow public insert (anyone can submit a demo request)
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (true);

-- Only admins can view demo requests (check profiles for admin status)
CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.admin_status = 'approved'
  )
);

-- Admins can update demo requests
CREATE POLICY "Admins can update demo requests"
ON public.demo_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.admin_status = 'approved'
  )
);