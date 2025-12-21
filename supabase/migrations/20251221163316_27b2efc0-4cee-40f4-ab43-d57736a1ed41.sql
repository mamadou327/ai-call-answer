-- Enable realtime for tables that don't have it yet
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;