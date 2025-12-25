import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  start_time: string;
  service: { name: string } | null;
  staff: { name: string } | null;
}

interface PublicCancelBookingProps {
  businessSlug: string;
  booking: Booking;
  currency: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const PublicCancelBooking = ({
  businessSlug,
  booking,
  currency,
  onBack,
  onSuccess,
}: PublicCancelBookingProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-cancel-booking", {
        body: {
          bookingId: booking.id,
          businessSlug,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Cannot cancel",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setCancelled(true);
      toast({
        title: "Booking cancelled",
        description: "Your booking has been successfully cancelled.",
      });
    } catch (error: any) {
      toast({
        title: "Cancellation failed",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (cancelled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Booking Cancelled</h2>
            <p className="text-muted-foreground mb-6">
              Your booking for {booking.service?.name || "your appointment"} on{" "}
              {formatDate(booking.start_time)} has been cancelled.
            </p>
            <Button onClick={onSuccess}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Cancel Booking</CardTitle>
          <CardDescription>
            Are you sure you want to cancel this booking?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <div className="space-y-2">
              <p className="font-semibold">{booking.service?.name || "Service"}</p>
              {booking.staff && (
                <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>
              )}
              <p className="text-sm">
                {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
              </p>
              <p className="text-xs text-muted-foreground">
                Booking Code: {booking.booking_code}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">This action cannot be undone</p>
              <p className="text-muted-foreground">
                Once cancelled, you will need to make a new booking if you wish to book again.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Booking"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
