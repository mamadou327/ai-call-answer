import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, Clock, User } from "lucide-react";
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
  created_by_user_id: string | null;
  last_modified_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  cancelled_at: string | null;
  notes: string | null;
  service?: { name: string };
  staff?: { name: string };
  creator_name?: string;
}

export const BookingsTab = ({ businessId }: BookingsTabProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

    if (data) {
      // Get creator names from profiles
      const userIds = data
        .map(b => b.created_by_user_id)
        .filter((id): id is string => id !== null);
      
      const uniqueUserIds = [...new Set(userIds)];
      
      let profileMap = new Map<string, string>();
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", uniqueUserIds);
        
        profiles?.forEach(p => {
          const name = p.first_name && p.last_name 
            ? `${p.first_name} ${p.last_name}`
            : p.email || "Unknown";
          profileMap.set(p.user_id, name);
        });
      }

      const enrichedData = data.map(booking => ({
        ...booking,
        creator_name: booking.created_by_user_id 
          ? profileMap.get(booking.created_by_user_id) || booking.created_by 
          : booking.created_by,
      }));
      
      setBookings(enrichedData);
    }
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
              {(showAll ? bookings : bookings.slice(0, 3)).map((booking) => (
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
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {booking.creator_name || booking.created_by}
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
              {bookings.length > 3 && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "Show Less" : `Show More (${bookings.length - 3} more)`}
                </Button>
              )}
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