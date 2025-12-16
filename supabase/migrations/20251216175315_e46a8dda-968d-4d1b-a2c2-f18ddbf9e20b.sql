-- Create admin_conversations table for message threads
CREATE TABLE public.admin_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'business')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_conversations ENABLE ROW LEVEL SECURITY;

-- Business owners can view conversations for their requests
CREATE POLICY "Business owners can view their conversations"
ON public.admin_conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM service_requests sr
    JOIN businesses b ON b.id = sr.business_id
    WHERE sr.id = admin_conversations.service_request_id
    AND b.owner_id = auth.uid()
  )
);

-- Business owners can insert messages to their conversations
CREATE POLICY "Business owners can reply to their conversations"
ON public.admin_conversations
FOR INSERT
WITH CHECK (
  sender_type = 'business' AND
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM service_requests sr
    JOIN businesses b ON b.id = sr.business_id
    WHERE sr.id = admin_conversations.service_request_id
    AND b.owner_id = auth.uid()
  )
);

-- Business owners can update read status on admin messages
CREATE POLICY "Business owners can mark messages as read"
ON public.admin_conversations
FOR UPDATE
USING (
  sender_type = 'admin' AND
  EXISTS (
    SELECT 1 FROM service_requests sr
    JOIN businesses b ON b.id = sr.business_id
    WHERE sr.id = admin_conversations.service_request_id
    AND b.owner_id = auth.uid()
  )
);

-- Super admins can view all conversations
CREATE POLICY "Super admins can view all conversations"
ON public.admin_conversations
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admins can insert replies
CREATE POLICY "Super admins can reply to conversations"
ON public.admin_conversations
FOR INSERT
WITH CHECK (
  sender_type = 'admin' AND
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Super admins can update read status
CREATE POLICY "Super admins can update conversations"
ON public.admin_conversations
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Sub admins with approve permission can view conversations
CREATE POLICY "Sub admins can view conversations"
ON public.admin_conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_approve_businesses = true
  )
);

-- Sub admins can reply
CREATE POLICY "Sub admins can reply to conversations"
ON public.admin_conversations
FOR INSERT
WITH CHECK (
  sender_type = 'admin' AND
  has_role(auth.uid(), 'sub_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_approve_businesses = true
  )
);

-- Sub admins can update
CREATE POLICY "Sub admins can update conversations"
ON public.admin_conversations
FOR UPDATE
USING (
  has_role(auth.uid(), 'sub_admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_permissions.user_id = auth.uid()
    AND admin_permissions.can_approve_businesses = true
  )
);