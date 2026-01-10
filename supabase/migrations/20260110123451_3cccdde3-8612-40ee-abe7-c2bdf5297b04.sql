-- Add has_sizes flag to menu_item_options for sides that have size variants
ALTER TABLE public.menu_item_options ADD COLUMN has_sizes BOOLEAN DEFAULT false;

-- Create table for option size variants (e.g., Small Rice £2.50, Large Rice £3.50)
CREATE TABLE public.menu_item_option_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID REFERENCES public.menu_item_options(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_menu_item_option_sizes_option_id ON public.menu_item_option_sizes(option_id);

-- Enable RLS
ALTER TABLE public.menu_item_option_sizes ENABLE ROW LEVEL SECURITY;

-- RLS policies - option sizes follow the same access as their parent option/business
CREATE POLICY "Option sizes are viewable by everyone" 
ON public.menu_item_option_sizes 
FOR SELECT 
USING (true);

CREATE POLICY "Business owners can manage option sizes" 
ON public.menu_item_option_sizes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.menu_item_options o
    JOIN public.menu_item_option_groups g ON o.option_group_id = g.id
    JOIN public.menu_items mi ON g.menu_item_id = mi.id
    JOIN public.businesses b ON mi.business_id = b.id
    WHERE o.id = menu_item_option_sizes.option_id
    AND b.owner_id = auth.uid()
  )
);