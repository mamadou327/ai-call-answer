-- Add new columns to customer_settings for additional data collection options
ALTER TABLE public.customer_settings
ADD COLUMN IF NOT EXISTS ask_how_heard boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ask_marketing_consent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ask_preferred_staff boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ask_notes_preferences boolean NOT NULL DEFAULT false;

-- Add columns to customers table for additional data
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS how_heard text,
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_staff_id uuid REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS notes_preferences text;

-- Create function to sync customer from booking
CREATE OR REPLACE FUNCTION public.sync_customer_from_booking()
RETURNS TRIGGER AS $$
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
        updated_at = now()
    WHERE id = existing_customer_id;
  ELSE
    -- Create new customer
    INSERT INTO public.customers (business_id, name, phone, first_visit_date, total_visits)
    VALUES (NEW.business_id, NEW.customer_name, NEW.customer_phone, NEW.start_time::date, 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to sync customers when booking is created
DROP TRIGGER IF EXISTS sync_customer_on_booking ON public.bookings;
CREATE TRIGGER sync_customer_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_from_booking();