-- Create a function to generate booking codes
CREATE OR REPLACE FUNCTION public.generate_booking_code(p_business_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Get first 3-4 uppercase letters from business name
  prefix := UPPER(REGEXP_REPLACE(SUBSTRING(p_business_name FROM 1 FOR 4), '[^A-Z]', '', 'gi'));
  -- Pad with X if too short
  WHILE LENGTH(prefix) < 3 LOOP
    prefix := prefix || 'X';
  END LOOP;
  prefix := SUBSTRING(prefix FROM 1 FOR 3);
  
  -- Generate unique code with retry
  LOOP
    random_suffix := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));
    new_code := prefix || '-' || random_suffix;
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create trigger function to auto-generate booking codes on insert
CREATE OR REPLACE FUNCTION public.set_booking_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  business_name TEXT;
BEGIN
  -- Only generate if booking_code is not provided
  IF NEW.booking_code IS NULL THEN
    SELECT b.business_name INTO business_name
    FROM businesses b
    WHERE b.id = NEW.business_id;
    
    NEW.booking_code := generate_booking_code(COALESCE(business_name, 'BKG'));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS tr_set_booking_code ON bookings;
CREATE TRIGGER tr_set_booking_code
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_code();

-- Backfill existing bookings with NULL booking_code
DO $$
DECLARE
  booking_record RECORD;
  business_name TEXT;
  new_code TEXT;
BEGIN
  FOR booking_record IN 
    SELECT b.id, b.business_id
    FROM bookings b
    WHERE b.booking_code IS NULL
  LOOP
    SELECT bs.business_name INTO business_name
    FROM businesses bs
    WHERE bs.id = booking_record.business_id;
    
    new_code := generate_booking_code(COALESCE(business_name, 'BKG'));
    
    UPDATE bookings
    SET booking_code = new_code
    WHERE id = booking_record.id;
  END LOOP;
END;
$$;

-- Add unique constraint on booking_code
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_code_unique UNIQUE (booking_code);

-- Make booking_code NOT NULL (after backfill)
ALTER TABLE bookings ALTER COLUMN booking_code SET NOT NULL;