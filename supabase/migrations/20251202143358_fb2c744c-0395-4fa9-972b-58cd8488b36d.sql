-- Fix function search path for generate_staff_join_code
CREATE OR REPLACE FUNCTION public.generate_staff_join_code(business_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_name text;
  prefix text;
  random_digits text;
BEGIN
  cleaned_name := lower(regexp_replace(business_name, '[^a-zA-Z0-9]', '', 'g'));
  prefix := upper(substring(cleaned_name from 1 for 4));
  WHILE length(prefix) < 4 LOOP
    prefix := prefix || 'X';
  END LOOP;
  random_digits := lpad(floor(random() * 10000)::text, 4, '0');
  RETURN prefix || '-' || random_digits;
END;
$$;