import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingDialog } from "./BookingDialog";
import { BookingDetailsDialog } from "./BookingDetailsDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface BookingsTabProps {
  businessId: string;
}

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  created_by: string;
  notes: string | null;
  service?: { name: string };
  staff?: { name: string };
}

export const BookingsTab = ({ businessId }: BookingsTabProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
    
    // Set up realtime subscription for new bookings
    const channel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const loadBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .order("start_time", { ascending: false });

    if (data) setBookings(data);
    setLoading(false);
  };

  const handleBookingSuccess = () => {
    loadBookings();
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("bookings.title")}</CardTitle>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("bookings.newBooking")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t("common.loading")}</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("bookings.noBookingsYet")}</p>
              <p className="text-sm">{t("bookings.description")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleBookingClick(booking)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <p className="font-medium">{booking.customer_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(booking.start_time), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {booking.created_by}
                    </Badge>
                    <Badge
                      variant={
                        booking.status === "confirmed"
                          ? "default"
                          : booking.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {t(`bookings.${booking.status}`)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDialog
        businessId={businessId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleBookingSuccess}
      />

      <BookingDetailsDialog
        booking={selectedBooking}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onDelete={loadBookings}
      />
    </div>
  );
};