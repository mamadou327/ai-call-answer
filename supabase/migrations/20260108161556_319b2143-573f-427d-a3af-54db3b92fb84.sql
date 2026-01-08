-- Create menu_item_sizes table for size variants with full prices
CREATE TABLE public.menu_item_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add has_sizes flag to menu_items
ALTER TABLE public.menu_items ADD COLUMN has_sizes BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.menu_item_sizes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - business owners can manage their menu item sizes
CREATE POLICY "Business owners can view their menu item sizes"
ON public.menu_item_sizes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.businesses b ON mi.business_id = b.id
    WHERE mi.id = menu_item_sizes.menu_item_id
    AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can insert menu item sizes"
ON public.menu_item_sizes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.businesses b ON mi.business_id = b.id
    WHERE mi.id = menu_item_sizes.menu_item_id
    AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can update their menu item sizes"
ON public.menu_item_sizes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.businesses b ON mi.business_id = b.id
    WHERE mi.id = menu_item_sizes.menu_item_id
    AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete their menu item sizes"
ON public.menu_item_sizes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.businesses b ON mi.business_id = b.id
    WHERE mi.id = menu_item_sizes.menu_item_id
    AND b.owner_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_menu_item_sizes_updated_at
BEFORE UPDATE ON public.menu_item_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();