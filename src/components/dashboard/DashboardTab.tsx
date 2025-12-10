import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, CalendarCheck, DollarSign, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";

interface DashboardTabProps {
  businessName: string;
  currency?: string;
  businessId: string;
}

export const DashboardTab = ({ businessName, currency = "GBP", businessId }: DashboardTabProps) => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [bookingsCount, setBookingsCount] = useState(0);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    loadDashboardData();

    // Set up realtime subscription for bookings
    const channel = supabase
      .channel('dashboard-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, dateRange, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom":
        if (customDateRange?.from && customDateRange?.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadDashboardData = async () => {
    const { start, end } = getDateRange();
    const today = new Date();

    // Load bookings count for selected period
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());

    if (count !== null) setBookingsCount(count);

    // Load today's appointments (always show today regardless of filter, exclude cancelled)
    const { data: todayData } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name, price),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_time", startOfDay(today).toISOString())
      .lte("start_time", endOfDay(today).toISOString())
      .order("start_time", { ascending: true });

    if (todayData) setTodaysAppointments(todayData);

    // Load upcoming bookings (next 5 from now, exclude cancelled)
    const { data: upcomingData } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5);

    if (upcomingData) setUpcomingBookings(upcomingData);

    // Calculate revenue for selected period (sum of service prices for confirmed bookings)
    const { data: revenueData } = await supabase
      .from("bookings")
      .select(`
        service:service_id(price)
      `)
      .eq("business_id", businessId)
      .eq("status", "confirmed")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());

    if (revenueData) {
      const total = revenueData.reduce((sum, booking) => {
        return sum + (booking.service?.price || 0);
      }, 0);
      setRevenue(total);
    }
  };

  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = {
      GBP: "£",
      USD: "$",
      EUR: "€",
      CAD: "$",
      AUD: "$",
      JPY: "¥",
      CHF: "CHF",
      SEK: "kr",
      NOK: "kr",
      DKK: "kr",
    };
    return symbols[curr] || "$";
  };

  const currencySymbol = getCurrencySymbol(currency);

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "today": return t("dashboard.today");
      case "week": return t("dashboard.thisWeek");
      case "month": return t("dashboard.thisMonth");
      case "custom": return t("dashboard.customRange");
      default: return t("dashboard.thisMonth");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">{t("dashboard.analytics")}</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-[140px] sm:w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("dashboard.today")}</SelectItem>
              <SelectItem value="week">{t("dashboard.thisWeek")}</SelectItem>
              <SelectItem value="month">{t("dashboard.thisMonth")}</SelectItem>
              <SelectItem value="custom">{t("dashboard.customRange")}</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === "custom" && (
            <DateRangePicker 
              dateRange={customDateRange}
              onDateRangeChange={setCustomDateRange}
            />
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.totalBookings")}</CardTitle>
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{bookingsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.totalCalls")}</CardTitle>
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">0</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.messages")}</CardTitle>
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">0</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{t("dashboard.unread")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.revenue")}</CardTitle>
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{currencySymbol}{revenue.toFixed(2)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("dashboard.todaysAppointments")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {todaysAppointments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <CalendarCheck className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">{t("dashboard.noAppointments")}</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {todaysAppointments.map((appointment) => (
                <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{appointment.customer_name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}
                    </p>
                    {appointment.service && (
                      <p className="text-xs text-muted-foreground truncate">{appointment.service.name}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                    <Badge variant="outline" className="text-xs">{appointment.status}</Badge>
                    {appointment.staff && (
                      <p className="text-xs text-muted-foreground">with {appointment.staff.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Recent Messages */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.recentMessages")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">{t("dashboard.noMessages")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.upcomingBookings")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm sm:text-base">{t("dashboard.noBookings")}</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{booking.customer_name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {format(new Date(booking.start_time), "MMM d 'at' h:mm a")}
                      </p>
                      {booking.service && (
                        <p className="text-xs text-muted-foreground truncate">{booking.service.name}</p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                      <Badge variant="outline" className="text-xs">{booking.status}</Badge>
                      {booking.staff && (
                        <p className="text-xs text-muted-foreground">with {booking.staff.name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
