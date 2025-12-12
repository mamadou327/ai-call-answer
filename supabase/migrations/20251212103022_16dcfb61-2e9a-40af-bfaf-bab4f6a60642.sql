-- Add title field to staff table (Mr, Mrs, Miss, Ms, Dr, etc.)
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS title text;

-- Add comment explaining the field
COMMENT ON COLUMN public.staff.title IS 'Title/honorific for the staff member (Mr, Mrs, Miss, Ms, Dr, etc.)';