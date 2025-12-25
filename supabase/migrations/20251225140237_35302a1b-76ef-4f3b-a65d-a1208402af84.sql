-- Add online booking columns to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_slug text UNIQUE,
ADD COLUMN IF NOT EXISTS custom_booking_domain text UNIQUE,
ADD COLUMN IF NOT EXISTS online_booking_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS online_booking_message text,
ADD COLUMN IF NOT EXISTS deposit_collection_timing text NOT NULL DEFAULT 'after_booking';

-- Create function to generate booking slug from business name
CREATE OR REPLACE FUNCTION public.generate_booking_slug(p_business_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  base_slug text;
  new_slug text;
  counter int := 0;
  slug_exists boolean;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(p_business_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Ensure minimum length
  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-booking';
  END IF;
  
  new_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  LOOP
    SELECT EXISTS(SELECT 1 FROM businesses WHERE booking_slug = new_slug) INTO slug_exists;
    EXIT WHEN NOT slug_exists;
    counter := counter + 1;
    new_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN new_slug;
END;
$$;

-- Create trigger to auto-generate booking slug on insert
CREATE OR REPLACE FUNCTION public.set_booking_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.booking_slug IS NULL THEN
    NEW.booking_slug := generate_booking_slug(NEW.business_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_slug_trigger ON businesses;
CREATE TRIGGER set_booking_slug_trigger
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_slug();

-- Generate booking slugs for existing businesses that don't have one
UPDATE businesses 
SET booking_slug = generate_booking_slug(business_name)
WHERE booking_slug IS NULL;

-- Create RLS policy for anonymous read access to businesses with online booking enabled
CREATE POLICY "Public can view businesses with online booking enabled"
ON public.businesses
FOR SELECT
USING (online_booking_enabled = true AND status = 'approved');

-- Create RLS policy for anonymous read access to services for online booking
CREATE POLICY "Public can view services for online booking"
ON public.services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = services.business_id 
    AND businesses.online_booking_enabled = true 
    AND businesses.status = 'approved'
  )
);

-- Create RLS policy for anonymous read access to staff for online booking
CREATE POLICY "Public can view staff for online booking"
ON public.staff
FOR SELECT
USING (
  ai_enabled = true AND
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = staff.business_id 
    AND businesses.online_booking_enabled = true 
    AND businesses.status = 'approved'
  )
);

-- Create RLS policy for anonymous read access to opening hours for online booking
CREATE POLICY "Public can view opening hours for online booking"
ON public.opening_hours
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = opening_hours.business_id 
    AND businesses.online_booking_enabled = true 
    AND businesses.status = 'approved'
  )
);