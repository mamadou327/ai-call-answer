-- Create trigger to sync customers from bookings
CREATE TRIGGER sync_customer_on_booking_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_from_booking();