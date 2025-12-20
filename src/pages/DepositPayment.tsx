import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";

const DepositPayment = () => {
  const { bookingCode } = useParams<{ bookingCode: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectToPayment = async () => {
      if (!bookingCode) {
        setError("No booking code provided");
        return;
      }

      // Look up the booking by code
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("deposit_payment_link, deposit_paid_at, status")
        .eq("booking_code", bookingCode.toUpperCase())
        .single();

      if (bookingError || !booking) {
        setError("Booking not found");
        return;
      }

      if (booking.deposit_paid_at) {
        setError("Deposit has already been paid");
        return;
      }

      if (booking.status === "cancelled") {
        setError("This booking has been cancelled");
        return;
      }

      if (!booking.deposit_payment_link) {
        setError("Payment link is not available. Please contact the business.");
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = booking.deposit_payment_link;
    };

    redirectToPayment();
  }, [bookingCode]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">{error}</h1>
          <p className="text-muted-foreground">
            If you need assistance, please contact the business directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecting to payment...</p>
      </div>
    </div>
  );
};

export default DepositPayment;
