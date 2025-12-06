import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, Clock, User, ChevronDown, ChevronUp, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingDialog } from "./BookingDialog";
import { BookingDetailsDialog } from "./BookingDetailsDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

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

  const handleReinstateBooking = async (e: React.MouseEvent, bookingId: string) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from("bookings")
      .update({ 
        status: "confirmed",
        cancelled_at: null,
        cancelled_by_user_id: null
      })
      .eq("id", bookingId);

    if (error) {
      toast({
        title: t("common.error"),
        description: "Failed to reinstate booking",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "Booking reinstated successfully",
      });
      loadBookings();
    }
  };

  // Filter bookings into active and cancelled
  const activeBookings = bookings.filter(b => b.status !== "cancelled");
  const cancelledBookings = bookings.filter(b => b.status === "cancelled");

  const getStatusBadge = (status: string) => {
    if (status === "confirmed") return "default";
    if (status === "cancelled") return "destructive";
    if (status === "completed") return "secondary";
    return "secondary";
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
          ) : activeBookings.length === 0 && cancelledBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("bookings.noBookingsYet")}</p>
              <p className="text-sm">{t("bookings.description")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Bookings */}
              <div className="space-y-2">
                {(showAll ? activeBookings : activeBookings.slice(0, 5)).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleBookingClick(booking)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{booking.customer_name}</p>
                          {booking.status === "completed" && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </div>
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
                      <Badge variant={getStatusBadge(booking.status)}>
                        {booking.status === "completed" ? "Completed" : t(`bookings.${booking.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {activeBookings.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? "Show Less" : `Show More (${activeBookings.length - 5} more)`}
                  </Button>
                )}
              </div>

              {/* Cancelled Bookings Section */}
              {cancelledBookings.length > 0 && (
                <Collapsible open={cancelledOpen} onOpenChange={setCancelledOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <span className="flex items-center gap-2">
                        Cancelled Bookings ({cancelledBookings.length})
                      </span>
                      {cancelledOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {cancelledBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer"
                        onClick={() => handleBookingClick(booking)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1">
                            <p className="font-medium text-muted-foreground line-through">
                              {booking.customer_name}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{format(new Date(booking.start_time), "MMM d, yyyy 'at' h:mm a")}</span>
                            </div>
                            {booking.cancelled_at && (
                              <p className="text-xs text-destructive mt-1">
                                Cancelled on {format(new Date(booking.cancelled_at), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500 text-green-600 hover:bg-green-50"
                            onClick={(e) => handleReinstateBooking(e, booking.id)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reinstate
                          </Button>
                          <Badge variant="destructive">
                            {t("bookings.cancelled")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
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