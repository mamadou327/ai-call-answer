-- Create orders table for restaurant pickup/delivery orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  order_type TEXT NOT NULL DEFAULT 'pickup',
  pickup_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  call_id UUID REFERENCES calls_log(id)
);

-- Create reservations table for dine-in restaurants
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  reservation_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  call_id UUID REFERENCES calls_log(id)
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
CREATE POLICY "Business owners can manage their orders"
ON public.orders FOR ALL
USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "Staff can view their business orders"
ON public.orders FOR SELECT
USING (
  business_id IN (SELECT business_id FROM staff_memberships WHERE user_id = auth.uid() AND status = 'approved')
);

-- RLS policies for reservations
CREATE POLICY "Business owners can manage their reservations"
ON public.reservations FOR ALL
USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "Staff can view their business reservations"
ON public.reservations FOR SELECT
USING (
  business_id IN (SELECT business_id FROM staff_memberships WHERE user_id = auth.uid() AND status = 'approved')
);

-- Create indexes for performance
CREATE INDEX idx_orders_business_id ON public.orders(business_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_reservations_business_id ON public.reservations(business_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_time ON public.reservations(reservation_time);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
  today_count INTEGER;
  order_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM orders
  WHERE business_id = p_business_id
    AND DATE(created_at) = CURRENT_DATE;
  
  order_num := 'ORD-' || TO_CHAR(CURRENT_DATE, 'MMDD') || '-' || LPAD(today_count::TEXT, 3, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();