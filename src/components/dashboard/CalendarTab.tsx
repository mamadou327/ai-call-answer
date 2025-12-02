import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, addDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  service?: { name: string };
  staff?: { name: string; color: string };
}

export const CalendarTab = ({ businessId, currency = "GBP" }: CalendarTabProps) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

    if (data) setBookings(data);
    setLoading(false);
  };

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(b => isSameDay(new Date(b.start_time), date));
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

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

  const renderDayView = () => {
    const dayBookings = getBookingsForDate(selectedDate);
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
        {dayBookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No appointments scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 rounded-lg border"
                style={{ borderLeftColor: booking.staff?.color || "#3B82F6", borderLeftWidth: "4px" }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{booking.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.customer_phone}</p>
                    <p className="text-sm">{booking.service?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(booking.start_time), "h:mm a")} - {format(new Date(booking.end_time), "h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-2">{booking.status}</Badge>
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
            {weekDays.map((day) => (
              <div 
                key={day.toISOString()} 
                className={`p-2 text-center border-l ${isSameDay(day, new Date()) ? "bg-primary/10" : ""}`}
              >
                <p className="text-sm font-medium">{format(day, "EEE")}</p>
                <p className={`text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground border-r">
                  {format(new Date().setHours(hour, 0), "h a")}
                </div>
                {weekDays.map((day) => {
                  const dayBookings = getBookingsForDate(day).filter(b => {
                    const bookingHour = new Date(b.start_time).getHours();
                    return bookingHour === hour;
                  });
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`p-1 border-l relative ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}
                    >
                      {dayBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="text-xs p-1 rounded mb-1 text-white truncate"
                          style={{ backgroundColor: booking.staff?.color || "#3B82F6" }}
                          title={`${booking.customer_name} - ${booking.service?.name} (${booking.staff?.name})`}
                        >
                          <p className="font-medium truncate">{booking.customer_name}</p>
                          <p className="truncate opacity-90">{booking.service?.name}</p>
                        </div>
                      ))}
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
      <div className="flex gap-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border"
          modifiers={{
            hasBookings: bookings.map(b => new Date(b.start_time))
          }}
          modifiersStyles={{
            hasBookings: { fontWeight: "bold", textDecoration: "underline" }
          }}
        />
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-4">
            Appointments on {format(selectedDate, "MMMM d, yyyy")}
          </h3>
          {getBookingsForDate(selectedDate).length === 0 ? (
            <p className="text-muted-foreground">No appointments</p>
          ) : (
            <div className="space-y-2">
              {getBookingsForDate(selectedDate).map((booking) => (
                <div
                  key={booking.id}
                  className="p-3 rounded-lg border flex justify-between items-center"
                  style={{ borderLeftColor: booking.staff?.color || "#3B82F6", borderLeftWidth: "4px" }}
                >
                  <div>
                    <p className="font-medium">{booking.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(booking.start_time), "h:mm a")} - {booking.service?.name}
                    </p>
                  </div>
                  {booking.staff && (
                    <Badge variant="secondary">{booking.staff.name}</Badge>
                  )}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.calendar")}</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[200px] text-center font-medium">
                {view === "month" 
                  ? format(selectedDate, "MMMM yyyy")
                  : view === "week"
                  ? `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d")}`
                  : format(selectedDate, "MMMM d, yyyy")}
              </span>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
            <div className="flex gap-1">
              <Button
                variant={view === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("day")}
              >
                Day
              </Button>
              <Button
                variant={view === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("week")}
              >
                Week
              </Button>
              <Button
                variant={view === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("month")}
              >
                Month
              </Button>
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
    </div>
  );
};
