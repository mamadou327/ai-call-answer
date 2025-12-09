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
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">{t("dashboard.analytics")}</h2>
        <div className="flex gap-2 items-center">
          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-[180px]">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalBookings")}</CardTitle>
            <CalendarCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingsCount}</div>
            <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalCalls")}</CardTitle>
            <Phone className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.messages")}</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.unread")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.revenue")}</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencySymbol}{revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.todaysAppointments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {todaysAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t("dashboard.noAppointments")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{appointment.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}
                    </p>
                    {appointment.service && (
                      <p className="text-xs text-muted-foreground">{appointment.service.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">{appointment.status}</Badge>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentMessages")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t("dashboard.noMessages")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.upcomingBookings")}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t("dashboard.noBookings")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.start_time), "PPP 'at' p")}
                      </p>
                      {booking.service && (
                        <p className="text-xs text-muted-foreground">{booking.service.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">{booking.status}</Badge>
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
