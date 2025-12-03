-- 1. Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  first_visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_visits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for phone/email lookup
CREATE INDEX idx_customers_business_phone ON public.customers(business_id, phone);
CREATE INDEX idx_customers_business_email ON public.customers(business_id, email);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for customers
CREATE POLICY "Business owners can manage their customers"
ON public.customers FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = customers.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Staff can view customers"
ON public.customers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM staff_memberships sm
  WHERE sm.business_id = customers.business_id
  AND sm.user_id = auth.uid()
  AND sm.status = 'active'
));

-- 2. Create customer_settings table for configurable data collection
CREATE TABLE public.customer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  collect_name BOOLEAN NOT NULL DEFAULT true,
  collect_phone BOOLEAN NOT NULL DEFAULT true,
  collect_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_settings
CREATE POLICY "Business owners can manage their customer settings"
ON public.customer_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = customer_settings.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

-- 3. Create messages table for call messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  caller_name TEXT,
  caller_phone TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  recipient_type TEXT NOT NULL DEFAULT 'all' CHECK (recipient_type IN ('staff', 'admin', 'all')),
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT false,
  call_id UUID REFERENCES public.calls_log(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for messages
CREATE INDEX idx_messages_business ON public.messages(business_id);
CREATE INDEX idx_messages_recipient ON public.messages(recipient_staff_id);
CREATE INDEX idx_messages_urgent ON public.messages(business_id, is_urgent);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Business owners can manage messages"
ON public.messages FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = messages.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Staff can view their own messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_memberships sm
    JOIN staff s ON s.business_id = sm.business_id
    WHERE sm.business_id = messages.business_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND (
      messages.recipient_type = 'all'
      OR (messages.recipient_type = 'staff' AND messages.recipient_staff_id = s.id)
    )
  )
);

-- 4. Add duration_ms column to calls_log for call duration tracking
ALTER TABLE public.calls_log ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.calls_log ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Trigger for updated_at on customers
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on customer_settings
CREATE TRIGGER update_customer_settings_updated_at
BEFORE UPDATE ON public.customer_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();