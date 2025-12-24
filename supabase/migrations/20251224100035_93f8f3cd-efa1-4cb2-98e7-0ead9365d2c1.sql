-- Add is_business_owner column to staff table
ALTER TABLE public.staff 
ADD COLUMN is_business_owner boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.staff.is_business_owner IS 'Indicates if this staff member is the business owner for transfer purposes';