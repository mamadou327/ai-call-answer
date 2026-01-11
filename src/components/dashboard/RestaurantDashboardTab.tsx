import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, DollarSign, Package, CheckCircle, XCircle, Plus, Calendar, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { StatDetailDialog } from "./StatDetailDialog";
import { RestaurantOrderQueue } from "./RestaurantOrderQueue";
import { ManualOrderDialog } from "./ManualOrderDialog";

interface RestaurantDashboardTabProps {
  businessName: string;
  currency?: string;
  businessId: string;
  businessType: string;
}

export const RestaurantDashboardTab = ({ businessName, currency = "GBP", businessId, businessType }: RestaurantDashboardTabProps) => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [ordersCount, setOrdersCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [callsCount, setCallsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [todaysReservations, setTodaysReservations] = useState<any[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<any[]>([]);
  const [cancelledReservations, setCancelledReservations] = useState<any[]>([]);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"orders" | "completed" | "cancelled" | "calls" | "messages" | "revenue">("orders");
  const [dialogData, setDialogData] = useState<any[]>([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();

    // Set up realtime subscriptions for orders
    const ordersChannel = supabase
      .channel('restaurant-dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadDashboardDataSilent();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('restaurant-dashboard-calls')
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
      .channel('restaurant-dashboard-messages')
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
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(messagesChannel);
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
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const loadDashboardDataSilent = async () => {
    const { start, end } = getDateRange();
    const today = new Date();

    const [ordersResult, completedResult, cancelledResult, callsResult, messagesResult, activeResult, revenueResult, todayReservationsResult, upcomingReservationsResult, cancelledReservationsResult] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "completed").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "cancelled").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("calls_log").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_read", false),
      supabase.from("orders").select("*").eq("business_id", businessId).in("status", ["pending", "confirmed", "preparing", "ready"]).order("created_at", { ascending: true }),
      supabase.from("orders").select("total").eq("business_id", businessId).eq("status", "completed").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      // Reservations queries
      supabase.from("reservations").select(`*, restaurant_tables:table_id(table_number)`).eq("business_id", businessId).in("status", ["confirmed", "seated"]).gte("reservation_time", startOfDay(today).toISOString()).lte("reservation_time", endOfDay(today).toISOString()).order("reservation_time", { ascending: true }),
      supabase.from("reservations").select(`*, restaurant_tables:table_id(table_number)`).eq("business_id", businessId).in("status", ["confirmed"]).gte("reservation_time", startOfDay(addDays(today, 1)).toISOString()).order("reservation_time", { ascending: true }).limit(5),
      supabase.from("reservations").select(`*, restaurant_tables:table_id(table_number)`).eq("business_id", businessId).eq("status", "cancelled").order("cancelled_at", { ascending: false }).limit(5)
    ]);

    if (ordersResult.count !== null) setOrdersCount(ordersResult.count);
    if (completedResult.count !== null) setCompletedCount(completedResult.count);
    if (cancelledResult.count !== null) setCancelledCount(cancelledResult.count);
    if (callsResult.count !== null) setCallsCount(callsResult.count);
    if (messagesResult.count !== null) setMessagesCount(messagesResult.count);
    if (activeResult.data) setActiveOrders(activeResult.data);
    if (revenueResult.data) {
      const total = revenueResult.data.reduce((sum, order) => sum + (order.total || 0), 0);
      setRevenue(total);
    }
    if (todayReservationsResult.data) setTodaysReservations(todayReservationsResult.data);
    if (upcomingReservationsResult.data) setUpcomingReservations(upcomingReservationsResult.data);
    if (cancelledReservationsResult.data) setCancelledReservations(cancelledReservationsResult.data);
  };

  const loadDashboardData = async () => {
    await loadDashboardDataSilent();
  };

  const openStatDialog = async (type: "orders" | "completed" | "cancelled" | "calls" | "messages" | "revenue") => {
    const { start, end } = getDateRange();
    let data: any[] = [];

    switch (type) {
      case "orders":
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("business_id", businessId)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at", { ascending: false });
        data = ordersData || [];
        break;
      case "completed":
        const { data: completedData } = await supabase
          .from("orders")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "completed")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("completed_at", { ascending: false });
        data = completedData || [];
        break;
      case "cancelled":
        const { data: cancelledData } = await supabase
          .from("orders")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "cancelled")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
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
          .from("orders")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "completed")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("completed_at", { ascending: false });
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
      default: return t("dashboard.today");
    }
  };

  const handleOrderUpdate = () => {
    loadDashboardDataSilent();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">{t("dashboard.analytics")}</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <Button onClick={() => setManualOrderOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Manual Order
          </Button>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("orders")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Orders</CardTitle>
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{ordersCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openStatDialog("completed")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{completedCount}</div>
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
            <Badge variant="secondary" className="text-[10px] px-1.5">unread</Badge>
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

      {/* Active Orders Queue */}
      <RestaurantOrderQueue 
        orders={activeOrders} 
        currency={currency}
        businessId={businessId}
        onOrderUpdate={handleOrderUpdate}
      />

      {/* Today's Reservations, Upcoming and Cancelled Sections */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Today's Reservations */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.todaysReservations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {todaysReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("dashboard.noReservationsToday")}
              </p>
            ) : (
              todaysReservations.map((reservation) => (
                <div key={reservation.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{reservation.customer_name}</p>
                    {reservation.customer_phone && (
                      <p className="text-xs text-muted-foreground truncate">{reservation.customer_phone}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reservation.reservation_time), "HH:mm")}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5 gap-1">
                        <Users className="w-2.5 h-2.5" />
                        {reservation.party_size}
                      </Badge>
                      {reservation.restaurant_tables?.table_number && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          Table {reservation.restaurant_tables.table_number}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={reservation.status === "seated" ? "default" : "outline"} 
                    className="text-xs ml-2 shrink-0"
                  >
                    {reservation.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Reservations */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.upcomingReservations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {upcomingReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("dashboard.noUpcomingReservations")}
              </p>
            ) : (
              upcomingReservations.map((reservation) => (
                <div key={reservation.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{reservation.customer_name}</p>
                    {reservation.customer_phone && (
                      <p className="text-xs text-muted-foreground truncate">{reservation.customer_phone}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reservation.reservation_time), "MMM d, HH:mm")}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 ml-2 shrink-0 gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {reservation.party_size}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cancelled Reservations */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.cancelledReservations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {cancelledReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("dashboard.noCancelledReservations")}
              </p>
            ) : (
              cancelledReservations.map((reservation) => (
                <div key={reservation.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{reservation.customer_name}</p>
                    {reservation.customer_phone && (
                      <p className="text-xs text-muted-foreground truncate">{reservation.customer_phone}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <XCircle className="w-3 h-3 text-destructive shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {reservation.cancelled_at ? format(new Date(reservation.cancelled_at), "MMM d, HH:mm") : "Unknown"}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 ml-2 shrink-0 gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {reservation.party_size}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stat Detail Dialog */}
      <StatDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType === "orders" ? "bookings" : dialogType === "completed" ? "bookings" : dialogType}
        data={dialogData}
        currency={currency}
      />

      {/* Manual Order Dialog */}
      <ManualOrderDialog
        open={manualOrderOpen}
        onOpenChange={setManualOrderOpen}
        businessId={businessId}
        currency={currency}
        onOrderCreated={handleOrderUpdate}
      />
    </div>
  );
};
