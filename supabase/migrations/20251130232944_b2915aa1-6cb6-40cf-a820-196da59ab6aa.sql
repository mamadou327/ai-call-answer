-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'business_owner');

-- Create enum for business status
CREATE TYPE public.business_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for number selection type
CREATE TYPE public.number_selection_type AS ENUM ('aivia_provided', 'port_existing', 'do_later');

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'deposit_paid', 'paid_in_full');

-- Create enum for call type
CREATE TYPE public.call_type AS ENUM ('new_booking', 'reschedule', 'cancel', 'question', 'complaint', 'other');

-- Create enum for tone
CREATE TYPE public.tone_type AS ENUM ('casual', 'neutral', 'formal');

-- Create enum for voice gender
CREATE TYPE public.voice_gender AS ENUM ('male', 'female', 'neutral');

-- Create enum for voice speed
CREATE TYPE public.voice_speed AS ENUM ('slow', 'normal', 'fast');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create businesses table
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  main_phone TEXT NOT NULL,
  secondary_phone TEXT,
  address TEXT NOT NULL,
  website TEXT,
  website_knowledge TEXT,
  staff_count INTEGER NOT NULL DEFAULT 1,
  status business_status NOT NULL DEFAULT 'pending',
  aivia_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create business_number_selection table
CREATE TABLE public.business_number_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  selection_type number_selection_type NOT NULL,
  document_urls TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  working_hours JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create opening_hours table
CREATE TABLE public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(business_id, day_of_week)
);

-- Create business_settings table
CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  cancellation_policy TEXT,
  max_days_advance INTEGER DEFAULT 30,
  min_booking_notice_hours INTEGER DEFAULT 2,
  min_cancellation_notice_hours INTEGER DEFAULT 24,
  primary_language TEXT DEFAULT 'English',
  tone tone_type DEFAULT 'neutral',
  assistant_name TEXT DEFAULT 'Aivia',
  voice_gender voice_gender DEFAULT 'female',
  voice_speed voice_speed DEFAULT 'normal',
  notification_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  booking_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create calls_log table
CREATE TABLE public.calls_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  caller_name TEXT,
  caller_phone TEXT NOT NULL,
  call_type call_type NOT NULL,
  call_outcome TEXT,
  summary TEXT,
  tags TEXT[],
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_number_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for businesses
CREATE POLICY "Business owners can view their own business"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Business owners can insert their own business"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Business owners can update their own business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all businesses"
  ON public.businesses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all businesses"
  ON public.businesses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for business_number_selection
CREATE POLICY "Business owners can manage their number selection"
  ON public.business_number_selection FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_number_selection.business_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all number selections"
  ON public.business_number_selection FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for services
CREATE POLICY "Business owners can manage their services"
  ON public.services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = services.business_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for staff
CREATE POLICY "Business owners can manage their staff"
  ON public.staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = staff.business_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for opening_hours
CREATE POLICY "Business owners can manage their opening hours"
  ON public.opening_hours FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = opening_hours.business_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for business_settings
CREATE POLICY "Business owners can manage their settings"
  ON public.business_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = business_settings.business_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for bookings
CREATE POLICY "Business owners can manage their bookings"
  ON public.bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = bookings.business_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for calls_log
CREATE POLICY "Business owners can view their calls"
  ON public.calls_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = calls_log.business_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can insert calls"
  ON public.calls_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = calls_log.business_id
      AND owner_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();