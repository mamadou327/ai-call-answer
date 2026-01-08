-- Phase 1: Restaurant Support Database Schema

-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1.1 Add new columns to businesses table for restaurant support
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'salon',
ADD COLUMN IF NOT EXISTS cuisine_type TEXT,
ADD COLUMN IF NOT EXISTS menu_link TEXT,
ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT ARRAY['card']::TEXT[],
ADD COLUMN IF NOT EXISTS require_prepayment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS prepayment_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS minimum_order_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS refund_policy TEXT DEFAULT 'full_refund',
ADD COLUMN IF NOT EXISTS refund_window_hours INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_radius_miles DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS delivery_minimum_order DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS average_prep_time_minutes INTEGER DEFAULT 30;

-- 1.2 Create restaurant_tables table for dine-in
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  location TEXT DEFAULT 'indoor',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on restaurant_tables
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- RLS policies for restaurant_tables
CREATE POLICY "Business owners can manage their tables"
ON public.restaurant_tables
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = restaurant_tables.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Public can view tables for online booking"
ON public.restaurant_tables
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = restaurant_tables.business_id
  AND businesses.online_booking_enabled = true
  AND businesses.status = 'approved'::business_status
));

-- 1.3 Create menu_categories table
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on menu_categories
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for menu_categories
CREATE POLICY "Business owners can manage their menu categories"
ON public.menu_categories
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = menu_categories.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Public can view menu categories for online booking"
ON public.menu_categories
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = menu_categories.business_id
  AND businesses.online_booking_enabled = true
  AND businesses.status = 'approved'::business_status
));

-- 1.4 Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  preparation_time_minutes INTEGER DEFAULT 15,
  is_available BOOLEAN DEFAULT true,
  dietary_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on menu_items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for menu_items
CREATE POLICY "Business owners can manage their menu items"
ON public.menu_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = menu_items.business_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Public can view menu items for online booking"
ON public.menu_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = menu_items.business_id
  AND businesses.online_booking_enabled = true
  AND businesses.status = 'approved'::business_status
));

-- 1.5 Add restaurant-specific columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS party_size INTEGER,
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS order_type TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS special_requests TEXT,
ADD COLUMN IF NOT EXISTS order_total DECIMAL(10,2);

-- 1.6 Create order_items table for pickup/delivery orders
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_items
CREATE POLICY "Business owners can manage order items"
ON public.order_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM bookings
  JOIN businesses ON businesses.id = bookings.business_id
  WHERE bookings.id = order_items.booking_id
  AND businesses.owner_id = auth.uid()
  AND businesses.status <> 'revoked'::business_status
));

CREATE POLICY "Staff can view order items for their bookings"
ON public.order_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bookings
  WHERE bookings.id = order_items.booking_id
  AND can_staff_access_booking(auth.uid(), bookings.business_id, bookings.staff_id)
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_business_id ON public.restaurant_tables(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_business_id ON public.menu_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON public.menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_order_items_booking_id ON public.order_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_order_type ON public.bookings(order_type);
CREATE INDEX IF NOT EXISTS idx_bookings_table_id ON public.bookings(table_id);

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_restaurant_tables_updated_at
BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_categories_updated_at
BEFORE UPDATE ON public.menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();