CREATE TABLE public.dealership_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text,
  is_active boolean NOT NULL DEFAULT true,
  handles_bookings boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dealership_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  registration text,
  vin text,
  make text NOT NULL,
  model text NOT NULL,
  variant text,
  year integer,
  colour text,
  fuel_type text,
  transmission text,
  mileage integer,
  price numeric(10,2),
  status text NOT NULL DEFAULT 'in_stock',
  body_type text,
  doors integer,
  engine_size text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dealership_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  call_log_id uuid REFERENCES public.calls_log(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  customer_email text,
  lead_type text NOT NULL DEFAULT 'sales',
  interested_in text,
  inventory_id uuid REFERENCES public.dealership_inventory(id) ON DELETE SET NULL,
  budget text,
  has_trade_in boolean,
  trade_in_details text,
  timeframe text,
  lead_score text NOT NULL DEFAULT 'warm',
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_departments TO authenticated;
GRANT ALL ON public.dealership_departments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_inventory TO authenticated;
GRANT ALL ON public.dealership_inventory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealership_leads TO authenticated;
GRANT ALL ON public.dealership_leads TO service_role;

ALTER TABLE public.dealership_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealership_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealership_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage their departments" ON public.dealership_departments
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = dealership_departments.business_id AND b.owner_id = auth.uid() AND b.status <> 'revoked'::business_status));

CREATE POLICY "Staff can view their business departments" ON public.dealership_departments
FOR SELECT TO authenticated
USING (business_id IN (SELECT public.get_staff_business_ids(auth.uid())));

CREATE POLICY "Super admins can view all departments" ON public.dealership_departments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Business owners can manage their inventory" ON public.dealership_inventory
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = dealership_inventory.business_id AND b.owner_id = auth.uid() AND b.status <> 'revoked'::business_status));

CREATE POLICY "Staff can view their business inventory" ON public.dealership_inventory
FOR SELECT TO authenticated
USING (business_id IN (SELECT public.get_staff_business_ids(auth.uid())));

CREATE POLICY "Super admins can view all inventory" ON public.dealership_inventory
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Business owners can manage their leads" ON public.dealership_leads
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = dealership_leads.business_id AND b.owner_id = auth.uid() AND b.status <> 'revoked'::business_status));

CREATE POLICY "Staff can view their business leads" ON public.dealership_leads
FOR SELECT TO authenticated
USING (business_id IN (SELECT public.get_staff_business_ids(auth.uid())));

CREATE POLICY "Super admins can view all leads" ON public.dealership_leads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_dealership_inventory_business ON public.dealership_inventory(business_id);
CREATE INDEX idx_dealership_inventory_search ON public.dealership_inventory(business_id, status, make, model);
CREATE INDEX idx_dealership_departments_business ON public.dealership_departments(business_id);
CREATE INDEX idx_dealership_leads_business ON public.dealership_leads(business_id, status, created_at DESC);

CREATE TRIGGER update_dealership_departments_updated_at BEFORE UPDATE ON public.dealership_departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dealership_inventory_updated_at BEFORE UPDATE ON public.dealership_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dealership_leads_updated_at BEFORE UPDATE ON public.dealership_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appointment_type text,
  ADD COLUMN IF NOT EXISTS vehicle_details text,
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES public.dealership_inventory(id) ON DELETE SET NULL;