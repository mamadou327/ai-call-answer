-- Update the booking code generator to use 3 letters + 4 digits format
CREATE OR REPLACE FUNCTION public.generate_booking_code(p_business_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix TEXT;
  sanitized TEXT;
  random_num INT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Sanitize: remove non-letters and convert to uppercase
  sanitized := UPPER(REGEXP_REPLACE(p_business_name, '[^A-Za-z]', '', 'g'));
  
  -- Take first 3 characters
  prefix := SUBSTRING(sanitized FROM 1 FOR 3);
  
  -- Pad with X if too short
  WHILE LENGTH(prefix) < 3 LOOP
    prefix := prefix || 'X';
  END LOOP;
  
  -- Generate unique code with 4-digit number
  LOOP
    random_num := FLOOR(RANDOM() * 10000)::INT;
    new_code := prefix || '-' || LPAD(random_num::TEXT, 4, '0');
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Regenerate all booking codes that don't match the new format
DO $$
DECLARE
  booking_record RECORD;
  business_name TEXT;
  new_code TEXT;
BEGIN
  FOR booking_record IN 
    SELECT b.id, b.business_id, b.booking_code
    FROM bookings b
    WHERE b.booking_code IS NULL 
       OR b.booking_code !~ '^[A-Z]{3}-[0-9]{4}$'
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