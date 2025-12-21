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
import { getCurrencySymbol } from "@/lib/utils";

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
  deposit_amount: number | null;
  deposit_paid_at: string | null;
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
  const [currency, setCurrency] = useState<string>("USD");

  // Fetch business currency
  useEffect(() => {
    const fetchCurrency = async () => {
      const { data } = await supabase
        .from("business_settings")
        .select("currency")
        .eq("business_id", businessId)
        .maybeSingle();
      if (data?.currency) {
        setCurrency(data.currency);
      }
    };
    fetchCurrency();
  }, [businessId]);

  useEffect(() => {
    loadBookings();
    
    // Set up realtime subscription with smart updates (no loading state flash)
    const channel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        async (payload) => {
          // Fetch the new booking with relations
          const { data } = await supabase
            .from("bookings")
            .select(`*, service:service_id(name), staff:staff_id(name)`)
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setBookings(prev => [data, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        async (payload) => {
          // Fetch the updated booking with relations
          const { data } = await supabase
            .from("bookings")
            .select(`*, service:service_id(name), staff:staff_id(name)`)
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setBookings(prev => prev.map(booking => 
              booking.id === payload.new.id ? { ...data, creator_name: booking.creator_name } : booking
            ));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          setBookings(prev => prev.filter(booking => booking.id !== payload.old.id));
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
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("bookings.title")}</CardTitle>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            {t("bookings.newBooking")}
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <p className="text-sm">{t("common.loading")}</p>
            </div>
          ) : activeBookings.length === 0 && cancelledBookings.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-base sm:text-lg mb-2">{t("bookings.noBookingsYet")}</p>
              <p className="text-xs sm:text-sm">{t("bookings.description")}</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Active Bookings */}
              <div className="space-y-2">
                {(showAll ? activeBookings : activeBookings.slice(0, 5)).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer gap-2 sm:gap-4"
                    onClick={() => handleBookingClick(booking)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm sm:text-base truncate">{booking.customer_name}</p>
                        {booking.status === "completed" && (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                        {/* Currency indicator for deposits */}
                        {booking.deposit_amount && booking.deposit_amount > 0 && (
                          <span 
                            className={`text-sm font-bold ${booking.deposit_paid_at ? "text-green-500" : "text-red-500"}`}
                            title={booking.deposit_paid_at ? "Deposit paid" : "Deposit unpaid"}
                          >
                            {getCurrencySymbol(currency)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">{format(new Date(booking.start_time), "MMM d 'at' h:mm a")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] sm:text-xs flex items-center gap-1">
                        <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="truncate max-w-[80px] sm:max-w-none">{booking.creator_name || booking.created_by}</span>
                      </Badge>
                      <Badge variant={getStatusBadge(booking.status)} className="text-[10px] sm:text-xs">
                        {booking.status === "completed" ? "Completed" : t(`bookings.${booking.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {activeBookings.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full mt-2 text-sm"
                    size="sm"
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
                      size="sm"
                      className="w-full justify-between border-destructive/30 text-destructive hover:bg-destructive/10 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        Cancelled ({cancelledBookings.length})
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-destructive/20 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer gap-2 sm:gap-4"
                        onClick={() => handleBookingClick(booking)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-muted-foreground line-through truncate">
                            {booking.customer_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">{format(new Date(booking.start_time), "MMM d 'at' h:mm a")}</span>
                          </div>
                          {booking.cancelled_at && (
                            <p className="text-[10px] sm:text-xs text-destructive mt-1">
                              Cancelled {format(new Date(booking.cancelled_at), "MMM d")}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500 text-green-600 hover:bg-green-50 text-xs h-7 sm:h-8 px-2 sm:px-3"
                            onClick={(e) => handleReinstateBooking(e, booking.id)}
                          >
                            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden xs:inline">Reinstate</span>
                          </Button>
                          <Badge variant="destructive" className="text-[10px] sm:text-xs">
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