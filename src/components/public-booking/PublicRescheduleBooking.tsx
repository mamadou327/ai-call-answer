import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle, Calendar } from "lucide-react";
import { PublicDateTimePicker } from "./PublicDateTimePicker";

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  start_time: string;
  service: { id: string; name: string; duration_minutes: number } | null;
  staff: { id: string; name: string } | null;
}

interface PublicRescheduleBookingProps {
  businessSlug: string;
  booking: Booking;
  currency: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const PublicRescheduleBooking = ({
  businessSlug,
  booking,
  currency,
  onBack,
  onSuccess,
}: PublicRescheduleBookingProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rescheduled, setRescheduled] = useState(false);
  const [newDateTime, setNewDateTime] = useState<{ date: Date; time: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const handleDateTimeSelect = (date: Date, time: string) => {
    setNewDateTime({ date, time });
    setShowDatePicker(false);
  };

  const handleReschedule = async () => {
    if (!newDateTime) return;

    setLoading(true);
    try {
      // Construct new start time
      const [hours, minutes] = newDateTime.time.split(":").map(Number);
      const newStartTime = new Date(newDateTime.date);
      newStartTime.setHours(hours, minutes, 0, 0);

      const { data, error } = await supabase.functions.invoke("public-reschedule-booking", {
        body: {
          bookingId: booking.id,
          businessSlug,
          newStartTime: newStartTime.toISOString(),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Cannot reschedule",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setRescheduled(true);
      toast({
        title: "Booking rescheduled",
        description: "Your booking has been successfully rescheduled.",
      });
    } catch (error: any) {
      toast({
        title: "Reschedule failed",
        description: error.message || "Failed to reschedule booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (rescheduled && newDateTime) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Booking Rescheduled</h2>
            <p className="text-muted-foreground mb-6">
              Your booking has been moved to{" "}
              {newDateTime.date.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              at {newDateTime.time}
            </p>
            <Button onClick={onSuccess}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showDatePicker && booking.service) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setShowDatePicker(false)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <PublicDateTimePicker
          businessSlug={businessSlug}
          serviceId={booking.service.id}
          staffId={booking.staff?.id}
          serviceDuration={booking.service.duration_minutes}
          onSelect={handleDateTimeSelect}
          onBack={() => setShowDatePicker(false)}
        />
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
          <CardTitle>Reschedule Booking</CardTitle>
          <CardDescription>
            Choose a new date and time for your booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Booking */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Current Booking:</p>
            <div className="space-y-1">
              <p className="font-semibold">{booking.service?.name || "Service"}</p>
              {booking.staff && (
                <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>
              )}
              <p className="text-sm">
                {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
              </p>
            </div>
          </div>

          {/* New Date/Time Selection */}
          {newDateTime ? (
            <div className="border-2 border-primary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">New Date & Time:</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {newDateTime.date.toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <p className="text-sm">{newDateTime.time}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowDatePicker(true)}>
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowDatePicker(true)}
              className="w-full h-auto py-4"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5" />
                <span>Select New Date & Time</span>
              </div>
            </Button>
          )}

          {newDateTime && (
            <Button onClick={handleReschedule} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Confirm Reschedule"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
