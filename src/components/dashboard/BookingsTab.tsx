import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingDialog } from "./BookingDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bookings Management</CardTitle>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No bookings yet</p>
              <p className="text-sm">Customer bookings will appear here once Aivia starts taking appointments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customer_phone}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 ml-8">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">
                        {format(new Date(booking.start_time), "PPP 'at' p")}
                      </p>
                    </div>

                    {booking.service && (
                      <p className="text-sm text-muted-foreground ml-8">
                        Service: {booking.service.name}
                      </p>
                    )}

                    {booking.staff && (
                      <p className="text-sm text-muted-foreground ml-8">
                        Staff: {booking.staff.name}
                      </p>
                    )}

                    {booking.notes && (
                      <p className="text-sm text-muted-foreground ml-8 italic">
                        Note: {booking.notes}
                      </p>
                    )}

                    <div className="ml-8 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Created by: {booking.created_by}
                      </Badge>
                    </div>
                  </div>

                  <Badge
                    variant={
                      booking.status === "confirmed"
                        ? "default"
                        : booking.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {booking.status}
                  </Badge>
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
    </div>
  );
};