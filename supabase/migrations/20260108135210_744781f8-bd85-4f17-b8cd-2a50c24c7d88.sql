-- Create menu item option groups table (e.g., "Size", "Choose Your Side")
CREATE TABLE public.menu_item_option_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create menu item options table (e.g., "Whole +£0", "Rice", "Chips +£1")
CREATE TABLE public.menu_item_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_group_id UUID NOT NULL REFERENCES public.menu_item_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_item_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;

-- RLS policies for option groups
CREATE POLICY "Business owners can manage their option groups"
ON public.menu_item_option_groups
FOR ALL
USING (EXISTS (
  SELECT 1 FROM menu_items mi
  JOIN businesses b ON b.id = mi.business_id
  WHERE mi.id = menu_item_option_groups.menu_item_id
  AND b.owner_id = auth.uid()
  AND b.status <> 'revoked'
));

CREATE POLICY "Public can view option groups for online booking"
ON public.menu_item_option_groups
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM menu_items mi
  JOIN businesses b ON b.id = mi.business_id
  WHERE mi.id = menu_item_option_groups.menu_item_id
  AND b.online_booking_enabled = true
  AND b.status = 'approved'
));

-- RLS policies for options
CREATE POLICY "Business owners can manage their options"
ON public.menu_item_options
FOR ALL
USING (EXISTS (
  SELECT 1 FROM menu_item_option_groups og
  JOIN menu_items mi ON mi.id = og.menu_item_id
  JOIN businesses b ON b.id = mi.business_id
  WHERE og.id = menu_item_options.option_group_id
  AND b.owner_id = auth.uid()
  AND b.status <> 'revoked'
));

CREATE POLICY "Public can view options for online booking"
ON public.menu_item_options
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM menu_item_option_groups og
  JOIN menu_items mi ON mi.id = og.menu_item_id
  JOIN businesses b ON b.id = mi.business_id
  WHERE og.id = menu_item_options.option_group_id
  AND b.online_booking_enabled = true
  AND b.status = 'approved'
));