-- Add semantic understanding fields to menu_items for voice AI
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS ingredients text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cooking_method text,
ADD COLUMN IF NOT EXISTS spice_level text,
ADD COLUMN IF NOT EXISTS common_aliases text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pairs_well_with text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_description text;

-- Add comment explaining these fields
COMMENT ON COLUMN public.menu_items.ingredients IS 'Key ingredients in the dish for voice AI understanding';
COMMENT ON COLUMN public.menu_items.cooking_method IS 'How the dish is prepared (grilled, fried, etc.)';
COMMENT ON COLUMN public.menu_items.spice_level IS 'Spice level: mild, medium, hot, extra hot';
COMMENT ON COLUMN public.menu_items.common_aliases IS 'Alternative names customers might use for this dish';
COMMENT ON COLUMN public.menu_items.pairs_well_with IS 'Names of other menu items that complement this dish';
COMMENT ON COLUMN public.menu_items.ai_description IS 'Natural language description for voice AI to use';