import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, addDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, User, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookingDetailsDialog } from "./BookingDetailsDialog";
import { useOpeningHours } from "@/hooks/use-opening-hours";

interface CalendarTabProps {
  businessId: string;
  currency?: string;
}

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  service?: { name: string } | null;
  staff?: { name: string; color: string } | null;
}

export const CalendarTab = ({ businessId, currency = "GBP" }: CalendarTabProps) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { openingHours, isDayClosed, getHoursForDate } = useOpeningHours(businessId);

  useEffect(() => {
    loadBookings();
    
    const channel = supabase
      .channel('calendar-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        () => loadBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, selectedDate, view]);

  const loadBookings = async () => {
    setLoading(true);
    let startDate: Date;
    let endDate: Date;

    if (view === "day") {
      startDate = startOfDay(selectedDate);
      endDate = endOfDay(selectedDate);
    } else if (view === "week") {
      startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
      endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else {
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
    }

    const { data } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name, color)
      `)
      .eq("business_id", businessId)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    // Filter out cancelled bookings from display
    if (data) setBookings(data.filter(b => b.status !== "cancelled"));
    setLoading(false);
  };

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(b => isSameDay(new Date(b.start_time), date));
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  // Get hours based on opening hours
  const getDisplayHours = () => {
    let minHour = 8;
    let maxHour = 20;

    openingHours.forEach(h => {
      if (!h.is_closed && h.open_time && h.close_time) {
        const openHour = parseInt(h.open_time.split(":")[0]);
        const closeHour = parseInt(h.close_time.split(":")[0]);
        minHour = Math.min(minHour, openHour);
        maxHour = Math.max(maxHour, closeHour + 1);
      }
    });

    return Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  };

  const hours = getDisplayHours();

  const isHourWithinOpeningHours = (date: Date, hour: number): boolean => {
    const { openTime, closeTime, isClosed } = getHoursForDate(date);
    if (isClosed || !openTime || !closeTime) return false;
    
    const openHour = parseInt(openTime.split(":")[0]);
    const closeHour = parseInt(closeTime.split(":")[0]);
    
    return hour >= openHour && hour < closeHour;
  };

  const navigatePrevious = () => {
    if (view === "day") {
      setSelectedDate(addDays(selectedDate, -1));
    } else if (view === "week") {
      setSelectedDate(addDays(selectedDate, -7));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (view === "day") {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (view === "week") {
      setSelectedDate(addDays(selectedDate, 7));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  const renderDayView = () => {
    const dayBookings = getBookingsForDate(selectedDate);
    const dayClosed = isDayClosed(selectedDate);
    const { openTime, closeTime } = getHoursForDate(selectedDate);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
          {dayClosed ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <X className="w-3 h-3" />
              Closed
            </Badge>
          ) : (
            <Badge variant="outline">{openTime} - {closeTime}</Badge>
          )}
        </div>
        {dayClosed ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
            <X className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium">Business Closed</p>
            <p className="text-sm">No appointments can be scheduled on this day</p>
          </div>
        ) : dayBookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No appointments scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors relative"
                style={{ borderLeftColor: booking.staff?.color || "#3B82F6", borderLeftWidth: "4px" }}
                onClick={() => handleBookingClick(booking)}
              >
                {booking.status === "completed" && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-5 h-5 text-green-500" />
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{booking.customer_name}</p>
                      {booking.status === "completed" && (
                        <Badge variant="secondary" className="text-xs">Completed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{booking.customer_phone}</p>
                    <p className="text-sm">{booking.service?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(booking.start_time), "h:mm a")} - {format(new Date(booking.end_time), "h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    {booking.status !== "completed" && (
                      <Badge variant="outline" className="mb-2">{booking.status}</Badge>
                    )}
                    {booking.staff && (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="w-3 h-3" />
                        <span>{booking.staff.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-center text-sm font-medium text-muted-foreground">Time</div>
            {weekDays.map((day) => {
              const dayClosed = isDayClosed(day);
              return (
                <div 
                  key={day.toISOString()} 
                  className={`p-2 text-center border-l ${isSameDay(day, new Date()) ? "bg-primary/10" : ""} ${dayClosed ? "bg-muted/50" : ""}`}
                >
                  <p className="text-sm font-medium">{format(day, "EEE")}</p>
                  <p className={`text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                    {format(day, "d")}
                  </p>
                  {dayClosed && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground border-r">
                  {format(new Date().setHours(hour, 0), "h a")}
                </div>
                {weekDays.map((day) => {
                  const dayClosed = isDayClosed(day);
                  const hourOpen = isHourWithinOpeningHours(day, hour);
                  const dayBookings = getBookingsForDate(day).filter(b => {
                    const bookingHour = new Date(b.start_time).getHours();
                    return bookingHour === hour;
                  });
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`p-1 border-l relative ${
                        dayClosed 
                          ? "bg-muted/30" 
                          : hourOpen 
                            ? isSameDay(day, new Date()) ? "bg-primary/5" : ""
                            : "bg-muted/20"
                      }`}
                    >
                      {dayClosed ? (
                        <div className="flex items-center justify-center h-full opacity-30">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        dayBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="text-xs p-1 rounded mb-1 text-white truncate cursor-pointer hover:opacity-80 transition-opacity relative"
                            style={{ backgroundColor: booking.staff?.color || "#3B82F6" }}
                            title={`${booking.customer_name} - ${booking.service?.name} (${booking.staff?.name})${booking.status === "completed" ? " ✓" : ""}`}
                            onClick={() => handleBookingClick(booking)}
                          >
                            <div className="flex items-center gap-1">
                              <p className="font-medium truncate flex-1">{booking.customer_name}</p>
                              {booking.status === "completed" && (
                                <Check className="w-3 h-3 flex-shrink-0" />
                              )}
                            </div>
                            <p className="truncate opacity-90">{booking.service?.name}</p>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border mx-auto lg:mx-0"
          modifiers={{
            hasBookings: bookings.map(b => new Date(b.start_time)),
            closed: (date) => isDayClosed(date),
          }}
          modifiersStyles={{
            hasBookings: { fontWeight: "bold", textDecoration: "underline" },
          }}
          modifiersClassNames={{
            closed: "text-muted-foreground/50 line-through",
          }}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold">
              {format(selectedDate, "MMM d, yyyy")}
            </h3>
            {isDayClosed(selectedDate) && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <X className="w-3 h-3" />
                Closed
              </Badge>
            )}
          </div>
          {isDayClosed(selectedDate) ? (
            <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
              <X className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>Business Closed</p>
            </div>
          ) : getBookingsForDate(selectedDate).length === 0 ? (
            <p className="text-muted-foreground text-sm">No appointments</p>
          ) : (
            <div className="space-y-2">
              {getBookingsForDate(selectedDate).map((booking) => (
                <div
                  key={booking.id}
                  className="p-3 rounded-lg border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  style={{ borderLeftColor: booking.staff?.color || "#3B82F6", borderLeftWidth: "4px" }}
                  onClick={() => handleBookingClick(booking)}
                >
                  <div className="flex items-center gap-2">
                    {booking.status === "completed" && (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{booking.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(booking.start_time), "h:mm a")} - {booking.service?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-6 sm:pl-0">
                    {booking.status === "completed" && (
                      <Badge variant="secondary" className="text-xs">Done</Badge>
                    )}
                    {booking.staff && (
                      <Badge variant="outline" className="text-xs">{booking.staff.name}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg sm:text-xl">{t("dashboard.calendar")}</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[140px] sm:min-w-[200px] text-center text-sm sm:text-base font-medium">
                {view === "month" 
                  ? format(selectedDate, "MMM yyyy")
                  : view === "week"
                  ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d")}`
                  : format(selectedDate, "MMM d, yyyy")}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <div className="flex gap-1">
                <Button
                  variant={view === "day" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                  onClick={() => setView("day")}
                >
                  Day
                </Button>
                <Button
                  variant={view === "week" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                  onClick={() => setView("week")}
                >
                  Week
                </Button>
                <Button
                  variant={view === "month" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                  onClick={() => setView("month")}
                >
                  Month
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {view === "day" && renderDayView()}
              {view === "week" && renderWeekView()}
              {view === "month" && renderMonthView()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <BookingDetailsDialog
        booking={selectedBooking}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onDelete={loadBookings}
      />
    </div>
  );
};
