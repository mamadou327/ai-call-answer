import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, addDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, User, X, Check, Palmtree, Clock, Users, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookingDetailsDialog } from "./BookingDetailsDialog";
import { useOpeningHours } from "@/hooks/use-opening-hours";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  staff_id?: string | null;
  service?: { name: string } | null;
  staff?: { id: string; name: string; color: string } | null;
}

interface TimeOff {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  notes: string | null;
  status: string;
  staff?: { id: string; name: string; color: string } | null;
}

interface StaffMember {
  id: string;
  name: string;
  color: string;
}

export const CalendarTab = ({ businessId, currency = "GBP" }: CalendarTabProps) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  const { openingHours, isDayClosed, getHoursForDate } = useOpeningHours(businessId);

  // Load staff list once
  useEffect(() => {
    const loadStaff = async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, name, color")
        .eq("business_id", businessId)
        .order("name");
      
      if (data) {
        setStaffList(data);
        // Initially select all staff
        setSelectedStaffIds(new Set(data.map(s => s.id)));
      }
    };
    loadStaff();
  }, [businessId]);

  useEffect(() => {
    loadData();
    
    const bookingsChannel = supabase
      .channel('calendar-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        () => loadData()
      )
      .subscribe();

    const timeOffChannel = supabase
      .channel('calendar-timeoff')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_time_off',
          filter: `business_id=eq.${businessId}`
        },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(timeOffChannel);
    };
  }, [businessId, selectedDate, view]);

  const loadData = async () => {
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

    // Load bookings and time off in parallel
    const [bookingsResult, timeOffResult] = await Promise.all([
      supabase
        .from("bookings")
        .select(`
          *,
          service:service_id(name),
          staff:staff_id(id, name, color)
        `)
        .eq("business_id", businessId)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())
        .order("start_time", { ascending: true }),
      supabase
        .from("staff_time_off")
        .select(`
          *,
          staff:staff_id(id, name, color)
        `)
        .eq("business_id", businessId)
        .eq("status", "approved")
        .or(`start_time.gte.${startDate.toISOString()},end_time.gte.${startDate.toISOString()}`)
        .lte("start_time", endDate.toISOString())
    ]);

    if (bookingsResult.data) setBookings(bookingsResult.data.filter(b => b.status !== "cancelled") as Booking[]);
    if (timeOffResult.data) setTimeOffs(timeOffResult.data as TimeOff[]);
    setLoading(false);
  };

  // Filter bookings and time offs based on selected staff
  const filteredBookings = useMemo(() => {
    if (selectedStaffIds.size === 0 || selectedStaffIds.size === staffList.length) {
      return bookings; // Show all if none or all selected
    }
    return bookings.filter(b => b.staff?.id && selectedStaffIds.has(b.staff.id));
  }, [bookings, selectedStaffIds, staffList.length]);

  const filteredTimeOffs = useMemo(() => {
    if (selectedStaffIds.size === 0 || selectedStaffIds.size === staffList.length) {
      return timeOffs;
    }
    return timeOffs.filter(to => to.staff?.id && selectedStaffIds.has(to.staff.id));
  }, [timeOffs, selectedStaffIds, staffList.length]);

  const getBookingsForDate = (date: Date) => {
    return filteredBookings.filter(b => isSameDay(new Date(b.start_time), date));
  };

  const getTimeOffsForDate = (date: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    return filteredTimeOffs.filter((to) => {
      const toStart = new Date(to.start_time);
      const toEnd = new Date(to.end_time);

      // Overlap check (end is treated as exclusive)
      return toStart < dayEnd && toEnd > dayStart;
    });
  };

  const getTimeOffsForHour = (date: Date, hour: number) => {
    const hourStart = new Date(date);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(date);
    hourEnd.setHours(hour, 59, 59, 999);

    return filteredTimeOffs.filter((to) => {
      const toStart = new Date(to.start_time);
      const toEnd = new Date(to.end_time);

      // Overlap check (end is treated as exclusive)
      return toStart < hourEnd && toEnd > hourStart;
    });
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const selectAllStaff = () => {
    setSelectedStaffIds(new Set(staffList.map(s => s.id)));
  };

  const clearStaffSelection = () => {
    setSelectedStaffIds(new Set());
  };

  const getStaffFilterLabel = () => {
    if (selectedStaffIds.size === 0) return "No staff selected";
    if (selectedStaffIds.size === staffList.length) return "All staff";
    if (selectedStaffIds.size === 1) {
      const staffId = Array.from(selectedStaffIds)[0];
      return staffList.find(s => s.id === staffId)?.name || "1 staff";
    }
    return `${selectedStaffIds.size} staff`;
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'vacation': return 'Vacation';
      case 'personal': return 'Personal';
      case 'sick': return 'Sick Leave';
      case 'other': return 'Time Off';
      default: return reason;
    }
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'vacation': return <Palmtree className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
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
    const dayTimeOffs = getTimeOffsForDate(selectedDate);
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

        {/* Time Off Section */}
        {dayTimeOffs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Staff Time Off</h4>
            {dayTimeOffs.map((timeOff) => (
              <div
                key={timeOff.id}
                className="p-3 rounded-lg border-2 border-dashed bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
              >
                <div className="flex items-center gap-2">
                  {getReasonIcon(timeOff.reason)}
                  <span className="font-medium">{timeOff.staff?.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {getReasonLabel(timeOff.reason)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(timeOff.start_time), "h:mm a")} - {format(new Date(timeOff.end_time), "h:mm a")}
                </p>
                {timeOff.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{timeOff.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {dayClosed ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
            <X className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium">Business Closed</p>
            <p className="text-sm">No appointments can be scheduled on this day</p>
          </div>
        ) : dayBookings.length === 0 && dayTimeOffs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No appointments scheduled for this day</p>
          </div>
        ) : dayBookings.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Appointments</h4>
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
        ) : null}
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
              const dayHasTimeOff = getTimeOffsForDate(day).length > 0;
              return (
                <div 
                  key={day.toISOString()} 
                  className={`p-2 text-center border-l ${isSameDay(day, new Date()) ? "bg-primary/10" : ""} ${dayClosed ? "bg-muted/50" : ""}`}
                >
                  <p className="text-sm font-medium">{format(day, "EEE")}</p>
                  <p className={`text-lg ${isSameDay(day, new Date()) ? "text-primary font-bold" : ""}`}>
                    {format(day, "d")}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    {dayClosed && (
                      <Badge variant="secondary" className="text-xs">
                        <X className="w-3 h-3" />
                      </Badge>
                    )}
                    {dayHasTimeOff && !dayClosed && (
                      <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 border-amber-300">
                        <Palmtree className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
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
                  const hourTimeOffs = getTimeOffsForHour(day, hour);
                  
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
                        /* All items (time offs + bookings) side by side */
                        (hourTimeOffs.length > 0 || dayBookings.length > 0) && (
                          <div className="flex gap-0.5 h-full">
                            {/* Time Off blocks */}
                            {hourTimeOffs.map((timeOff) => (
                              <div
                                key={timeOff.id}
                                className="text-xs p-1 rounded truncate bg-amber-100 dark:bg-amber-900/40 border border-dashed border-amber-400 text-amber-800 dark:text-amber-200 flex-1 min-w-0"
                                title={`${timeOff.staff?.name} - ${getReasonLabel(timeOff.reason)}${timeOff.notes ? `: ${timeOff.notes}` : ''}`}
                              >
                                <div className="flex items-center gap-0.5">
                                  {getReasonIcon(timeOff.reason)}
                                  <p className="font-medium truncate text-[10px]">{timeOff.staff?.name}</p>
                                </div>
                                <p className="truncate opacity-80 text-[9px]">{getReasonLabel(timeOff.reason)}</p>
                              </div>
                            ))}
                            {/* Booking blocks */}
                            {dayBookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity relative flex-1 min-w-0"
                                style={{ backgroundColor: booking.staff?.color || "#3B82F6" }}
                                title={`${booking.customer_name} - ${booking.service?.name} (${booking.staff?.name})${booking.status === "completed" ? " ✓" : ""}`}
                                onClick={() => handleBookingClick(booking)}
                              >
                                <div className="flex items-center gap-0.5">
                                  <p className="font-medium truncate flex-1 text-[10px]">{booking.customer_name}</p>
                                  {booking.status === "completed" && (
                                    <Check className="w-2.5 h-2.5 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="truncate opacity-90 text-[9px]">{booking.service?.name}</p>
                              </div>
                            ))}
                          </div>
                        )
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
    const dayTimeOffs = getTimeOffsForDate(selectedDate);
    const dayBookings = getBookingsForDate(selectedDate);
    
    return (
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border mx-auto lg:mx-0"
          modifiers={{
            hasBookings: bookings.map(b => new Date(b.start_time)),
            hasTimeOff: timeOffs.map(to => new Date(to.start_time)),
            closed: (date) => isDayClosed(date),
          }}
          modifiersStyles={{
            hasBookings: { fontWeight: "bold", textDecoration: "underline" },
            hasTimeOff: { backgroundColor: "rgb(254 243 199)" },
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

          {/* Time Off Section */}
          {dayTimeOffs.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-xs font-medium text-muted-foreground">Staff Time Off</h4>
              {dayTimeOffs.map((timeOff) => (
                <div
                  key={timeOff.id}
                  className="p-2 rounded-lg border-2 border-dashed bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                >
                  <div className="flex items-center gap-2">
                    {getReasonIcon(timeOff.reason)}
                    <span className="font-medium text-sm">{timeOff.staff?.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {getReasonLabel(timeOff.reason)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(timeOff.start_time), "h:mm a")} - {format(new Date(timeOff.end_time), "h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isDayClosed(selectedDate) ? (
            <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
              <X className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>Business Closed</p>
            </div>
          ) : dayBookings.length === 0 && dayTimeOffs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No appointments or time off</p>
          ) : dayBookings.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Appointments</h4>
              {dayBookings.map((booking) => (
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
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg sm:text-xl">{t("dashboard.calendar")}</CardTitle>
            {staffList.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Users className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{getStaffFilterLabel()}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
                  <DropdownMenuLabel>Filter by Staff</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="flex gap-2 px-2 py-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={selectAllStaff}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={clearStaffSelection}>
                      Clear
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  {staffList.map((staff) => (
                    <DropdownMenuCheckboxItem
                      key={staff.id}
                      checked={selectedStaffIds.has(staff.id)}
                      onCheckedChange={() => toggleStaffSelection(staff.id)}
                      className="gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: staff.color }}
                      />
                      {staff.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
        onDelete={loadData}
      />
    </div>
  );
};
