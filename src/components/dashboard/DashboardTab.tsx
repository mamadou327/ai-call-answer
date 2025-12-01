import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, MessageSquare, CalendarCheck, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface DashboardTabProps {
  businessName: string;
  currency?: string;
  businessId: string;
}

export const DashboardTab = ({ businessName, currency = "GBP", businessId }: DashboardTabProps) => {
  const { t } = useTranslation();
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [bookingsCount, setBookingsCount] = useState(0);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);

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
  }, [businessId]);

  const loadDashboardData = async () => {
    // Load bookings count
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);

    if (count !== null) setBookingsCount(count);

    // Load upcoming bookings
    const { data } = await supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5);

    if (data) setUpcomingBookings(data);
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
            <p className="text-xs text-muted-foreground">{t("dashboard.totalBookings")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.totalCalls")}</CardTitle>
            <Phone className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.thisMonth")}</p>
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
            <div className="text-2xl font-bold">{currencySymbol}0</div>
            <p className="text-xs text-muted-foreground">
              {dateRange === "today" ? t("dashboard.today") : dateRange === "week" ? t("dashboard.thisWeek") : dateRange === "month" ? t("dashboard.thisMonth") : t("dashboard.customRange")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.todaysAppointments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t("dashboard.noAppointments")}</p>
          </div>
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
                    <Badge variant="outline" className="text-xs">
                      {booking.created_by}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.calendar")}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={calendarView === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarView("day")}
            >
              {t("dashboard.day")}
            </Button>
            <Button
              variant={calendarView === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarView("week")}
            >
              {t("dashboard.week")}
            </Button>
            <Button
              variant={calendarView === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarView("month")}
            >
              {t("dashboard.month")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{t("dashboard.calendarView")} ({calendarView})</p>
            <p className="text-sm">{t("dashboard.calendarComingSoon")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};