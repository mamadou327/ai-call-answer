ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS transferable_to_calls boolean NOT NULL DEFAULT false;

-- Owners are always transferable
UPDATE public.staff SET transferable_to_calls = true WHERE is_business_owner = true;

-- Keep owners always transferable going forward
CREATE OR REPLACE FUNCTION public.enforce_owner_transferable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_business_owner = true THEN
    NEW.transferable_to_calls := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_owner_transferable ON public.staff;
CREATE TRIGGER trg_enforce_owner_transferable
BEFORE INSERT OR UPDATE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_transferable();