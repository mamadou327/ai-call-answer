-- Add customer_email column to bookings table
ALTER TABLE public.bookings ADD COLUMN customer_email text;

-- Update the sync function to also save email
CREATE OR REPLACE FUNCTION public.sync_customer_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_customer_id uuid;
BEGIN
  -- Try to find existing customer by phone
  SELECT id INTO existing_customer_id
  FROM public.customers
  WHERE business_id = NEW.business_id
    AND (phone = NEW.customer_phone OR (phone IS NULL AND NEW.customer_phone IS NULL));
  
  IF existing_customer_id IS NOT NULL THEN
    -- Update existing customer
    UPDATE public.customers
    SET total_visits = total_visits + 1,
        name = COALESCE(name, NEW.customer_name),
        email = COALESCE(email, NEW.customer_email),
        updated_at = now()
    WHERE id = existing_customer_id;
  ELSE
    -- Create new customer
    INSERT INTO public.customers (business_id, name, phone, email, first_visit_date, total_visits)
    VALUES (NEW.business_id, NEW.customer_name, NEW.customer_phone, NEW.customer_email, NEW.start_time::date, 1);
  END IF;
  
  RETURN NEW;
END;
$$;