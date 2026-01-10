import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, CalendarCheck, DollarSign, Calendar, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { StatDetailDialog } from "./StatDetailDialog";

interface DashboardTabProps {
  businessName: string;
  currency?: string;
  businessId: string;
  businessType?: string | null;
}

const RESTAURANT_TYPES = ["restaurant_pickup", "restaurant_dine_in", "restaurant_hybrid"];

export const DashboardTab = ({ businessName, currency = "GBP", businessId, businessType }: DashboardTabProps) => {
  const { t } = useTranslation();
  const isRestaurant = RESTAURANT_TYPES.includes(businessType || "");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [bookingsCount, setBookingsCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [callsCount, setCallsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"bookings" | "cancelled" | "calls" | "messages" | "revenue">("bookings");
  const [dialogData, setDialogData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();

    // Set up realtime subscriptions for bookings, calls, and messages (smart refresh without loading state)
    const bookingsChannel = supabase
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
          // Refresh silently without loading state
          loadDashboardDataSilent();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('dashboard-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls_log',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadDashboardDataSilent();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('dashboard-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadDashboardDataSilent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [businessId, dateRange, customDateRange]);

  // Silent refresh without loading state (for realtime updates)
  const loadDashboardDataSilent = async () => {
    const { start, end } = getDateRange();
    const today = new Date();

    const [bookingsResult, cancelledResult, callsResult, messagesResult, todayResult, upcomingResult, cancelledBookingsResult, revenueResult] = await Promise.all([
      supabase.from("bookings").select("*", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["confirmed", "completed"]).gte("start_time", start.toISOString()).lte("start_time", end.toISOString()),
      supabase.from("bookings").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "cancelled").gte("start_time", start.toISOString()).lte("start_time", end.toISOString()),
      supabase.from("calls_log").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_read", false),
      supabase.from("bookings").select(`*, service:service_id(name, price), staff:staff_id(name)`).eq("business_id", businessId).in("status", ["confirmed", "completed"]).gte("start_time", startOfDay(today).toISOString()).lte("start_time", endOfDay(today).toISOString()).order("start_time", { ascending: true }),
      supabase.from("bookings").select(`*, service:service_id(name), staff:staff_id(name)`).eq("business_id", businessId).in("status", ["confirmed", "completed"]).gte("start_time", startOfDay(addDays(today, 1)).toISOString()).order("start_time", { ascending: true }).limit(5),
      supabase.from("bookings").select(`*, service:service_id(name), staff:staff_id(name)`).eq("business_id", businessId).eq("status", "cancelled").order("cancelled_at", { ascending: false }).limit(5),
      supabase.from("bookings").select(`service:service_id(price)`).eq("business_id", businessId).in("status", ["confirmed", "completed"]).gte("start_time", start.toISOString()).lte("start_time", end.toISOString())
    ]);

    if (bookingsResult.count !== null) setBookingsCount(bookingsResult.count);
    if (cancelledResult.count !== null) setCancelledCount(cancelledResult.count);
    if (callsResult.count !== null) setCallsCount(callsResult.count);
    if (messagesResult.count !== null) setMessagesCount(messagesResult.count);
    if (todayResult.data) setTodaysAppointments(todayResult.data);
    if (upcomingResult.data) setUpcomingBookings(upcomingResult.data);
    if (cancelledBookingsResult.data) setCancelledBookings(cancelledBookingsResult.data);
    if (revenueResult.data) {
      const total = revenueResult.data.reduce((sum, booking) => sum + (booking.service?.price || 0), 0);
      setRevenue(total);
    }
  };

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

    // Load bookings count for selected period (only confirmed/completed - pending bookings are hidden)
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["confirmed", "completed"])
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());

    if (count !== null) setBookingsCount(count);

    // Load cancelled bookings count for selected period
    const { count: cancelledCountResult } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "cancelled")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());

    if (cancelledCountResult !== null) setCancelledCount(cancelledCountResult);

    // Load calls count for selected period
    const { count: callsCountResult } = await supabase
      .from("calls_log")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (callsCountResult !== null) setCallsCount(callsCountResult);

    // Load unread messages count
    const { count: messagesCountResult } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("is_read", false);

    if (messagesCountResult !== null) setMessagesCount(messagesCountResult);

    // Load today's appointments (always show today regardless of filter, only confirmed/completed)
    const { data: todayData } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name, price),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .in("status", ["confirmed", "completed"])
      .gte("start_time", startOfDay(today).toISOString())
      .lte("start_time", endOfDay(today).toISOString())
      .order("start_time", { ascending: true });

    if (todayData) setTodaysAppointments(todayData);

    // Load upcoming bookings (next 5 from tomorrow onwards, only confirmed/completed)
    const { data: upcomingData } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .in("status", ["confirmed", "completed"])
      .gte("start_time", startOfDay(addDays(today, 1)).toISOString())
      .order("start_time", { ascending: true })
      .limit(5);

    if (upcomingData) setUpcomingBookings(upcomingData);

    // Load recent cancelled bookings (last 5)
    const { data: cancelledData } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .eq("status", "cancelled")
      .order("cancelled_at", { ascending: false })
      .limit(5);

    if (cancelledData) setCancelledBookings(cancelledData);

    // Calculate revenue for selected period (sum of service prices for confirmed bookings)
    const { data: revenueData } = await supabase
      .from("bookings")
      .select(`
        service:service_id(price)
      `)
      .eq("business_id", businessId)
      .in("status", ["confirmed", "completed"])
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString());

    if (revenueData) {
      const total = revenueData.reduce((sum, booking) => {
        return sum + (booking.service?.price || 0);
      }, 0);
      setRevenue(total);
    }
  };

  const openStatDialog = async (type: "bookings" | "cancelled" | "calls" | "messages" | "revenue") => {
    const { start, end } = getDateRange();
    let data: any[] = [];

    switch (type) {
      case "bookings":
        const { data: bookingsData } = await supabase
          .from("bookings")
          .select(`*, service:service_id(name, price), staff:staff_id(name)`)
          .eq("business_id", businessId)
          .in("status", ["confirmed", "completed"])
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString())
          .order("start_time", { ascending: false });
        data = bookingsData || [];
        break;
      case "cancelled":
        const { data: cancelledData } = await supabase
          .from("bookings")
          .select(`*, service:service_id(name, price), staff:staff_id(name)`)
          .eq("business_id", businessId)
          .eq("status", "cancelled")
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString())
          .order("cancelled_at", { ascending: false });
        data = cancelledData || [];
        break;
      case "calls":
        const { data: callsData } = await supabase
          .from("calls_log")
          .select("*")
          .eq("business_id", businessId)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at", { ascending: false });
        data = callsData || [];
        break;
      case "messages":
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });
        data = messagesData || [];
        break;
      case "revenue":
        const { data: revenueData } = await supabase
          .from("bookings")
          .select(`*, service:service_id(name, price), staff:staff_id(name)`)
          .eq("business_id", businessId)
          .in("status", ["confirmed", "completed"])
          .gte("start_time", start.toISOString())
          .lte("start_time", end.toISOString())
          .order("start_time", { ascending: false });
        data = revenueData || [];
        break;
    }

    setDialogType(type);
    setDialogData(data);
    setDialogOpen(true);
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("bookings")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              {isRestaurant ? "Total Orders" : t("dashboard.totalBookings")}
            </CardTitle>
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{bookingsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("cancelled")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-destructive">{cancelledCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("calls")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.totalCalls")}</CardTitle>
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{callsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("messages")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.messages")}</CardTitle>
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{messagesCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{t("dashboard.unread")}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("revenue")}>
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

      {/* Today's Appointments/Orders */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {isRestaurant ? "Today's Orders" : t("dashboard.todaysAppointments")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {todaysAppointments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <CalendarCheck className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">
                {isRestaurant ? "No orders scheduled for today" : t("dashboard.noAppointments")}
              </p>
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
        {/* Upcoming Bookings/Orders */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {isRestaurant ? "Upcoming Orders" : t("dashboard.upcomingBookings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm sm:text-base">
                  {isRestaurant ? "No upcoming orders" : t("dashboard.noBookings")}
                </p>
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

        {/* Cancelled Bookings/Orders */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              {isRestaurant ? "Cancelled Orders" : "Cancelled Bookings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {cancelledBookings.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <XCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm sm:text-base">
                  {isRestaurant ? "No cancelled orders" : "No cancelled bookings"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {cancelledBookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-destructive/20 bg-destructive/5 rounded-lg gap-2">
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
                      <Badge variant="destructive" className="text-xs">cancelled</Badge>
                      {booking.cancelled_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.cancelled_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StatDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        data={dialogData}
        currency={currency}
      />
    </div>
  );
};
