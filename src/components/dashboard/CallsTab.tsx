import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, ChevronRight, CalendarCheck, HelpCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { CallDetailsDialog } from "./CallDetailsDialog";
import { DateRangePicker } from "./DateRangePicker";
import { DateRange } from "react-day-picker";
import { DEMO_CALLS_STATS, DEMO_SALON_CALLS, DEMO_RESTAURANT_CALLS, DEMO_DINEIN_CALLS } from "@/lib/demoData";

interface CallsTabProps {
  businessId?: string;
  isDemoMode?: boolean;
  businessType?: string | null;
}

const getDemoCalls = (businessType?: string | null) => {
  if (businessType === "restaurant_pickup") return DEMO_RESTAURANT_CALLS;
  if (businessType === "restaurant_dine_in") return DEMO_DINEIN_CALLS;
  if (businessType === "restaurant_hybrid") return DEMO_RESTAURANT_CALLS;
  return DEMO_SALON_CALLS;
};

interface CallLog {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  call_type: string;
  call_outcome: string | null;
  summary: string | null;
  duration_ms: number | null;
  needs_review: boolean | null;
  tags: string[] | null;
  booking_id: string | null;
  created_at: string;
  provider: string | null;
  recording_url: string | null;
  transcription: string | null;
}

const callTypeLabels: Record<string, string> = {
  new_booking: "Booking Created",
  reschedule: "Reschedule",
  cancel: "Cancellation",
  question: "General Enquiry",
  complaint: "Complaint",
  other: "Other",
};

const callTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_booking: "default",
  reschedule: "secondary",
  cancel: "destructive",
  question: "outline",
  complaint: "destructive",
  other: "outline",
};

export const CallsTab = ({ businessId, isDemoMode = false, businessType }: CallsTabProps) => {
  const { t } = useTranslation();
  const demoCalls = getDemoCalls(businessType);
  const [calls, setCalls] = useState<CallLog[]>(isDemoMode ? demoCalls as CallLog[] : []);
  const [loading, setLoading] = useState(!isDemoMode);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Analytics state
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [totalCalls, setTotalCalls] = useState(isDemoMode ? DEMO_CALLS_STATS.totalCalls : 0);
  const [bookingsCreated, setBookingsCreated] = useState(isDemoMode ? DEMO_CALLS_STATS.bookingsCreated : 0);
  const [enquiries, setEnquiries] = useState(isDemoMode ? DEMO_CALLS_STATS.enquiries : 0);
  const [cancellations, setCancellations] = useState(isDemoMode ? DEMO_CALLS_STATS.cancellations : 0);

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

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "today": return t("dashboard.today");
      case "week": return t("dashboard.thisWeek");
      case "month": return t("dashboard.thisMonth");
      case "custom": return t("dashboard.customRange");
      default: return t("dashboard.thisMonth");
    }
  };

  useEffect(() => {
    if (isDemoMode) return; // Skip data loading in demo mode
    if (businessId) {
      loadCalls();
      loadAnalytics();
      
      // Set up realtime subscription with smart updates
      const channel = supabase
        .channel('calls-log-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls_log',
            filter: `business_id=eq.${businessId}`
          },
          (payload) => {
            setCalls(prev => [payload.new as CallLog, ...prev].slice(0, 50));
            loadAnalytics(); // Refresh analytics on new call
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls_log',
            filter: `business_id=eq.${businessId}`
          },
          (payload) => {
            setCalls(prev => prev.map(call => 
              call.id === payload.new.id ? payload.new as CallLog : call
            ));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'calls_log',
            filter: `business_id=eq.${businessId}`
          },
          (payload) => {
            setCalls(prev => prev.filter(call => call.id !== payload.old.id));
            loadAnalytics();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [businessId]);

  // Reload analytics when date range changes
  useEffect(() => {
    if (isDemoMode) return; // Skip in demo mode
    if (businessId) {
      loadAnalytics();
    }
  }, [businessId, dateRange, customDateRange, isDemoMode]);

  const loadAnalytics = async () => {
    if (!businessId) return;
    
    const { start, end } = getDateRange();
    
    const [totalResult, bookingsResult, enquiriesResult, cancellationsResult] = await Promise.all([
      supabase
        .from("calls_log")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("calls_log")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("call_type", "new_booking")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("calls_log")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("call_type", "question")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("calls_log")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("call_type", "cancel")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
    ]);

    setTotalCalls(totalResult.count || 0);
    setBookingsCreated(bookingsResult.count || 0);
    setEnquiries(enquiriesResult.count || 0);
    setCancellations(cancellationsResult.count || 0);
  };

  const loadCalls = async () => {
    if (!businessId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("calls_log")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading calls:", error);
    } else {
      setCalls(data || []);
    }
    setLoading(false);
  };

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
    setDialogOpen(true);
  };


  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">Call Analytics</h2>
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

      {/* Analytics Cards */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Calls</CardTitle>
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalCalls}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Bookings Created</CardTitle>
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-primary">{bookingsCreated}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Enquiries</CardTitle>
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{enquiries}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Cancellations</CardTitle>
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-destructive">{cancellations}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calls List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Recent Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading calls...</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("dashboard.noCalls")}</p>
              <p className="text-sm">{t("dashboard.callsDescription")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {calls.map((call) => {
                const displayName = call.caller_name || call.caller_phone;

                return (
                  <div
                    key={call.id}
                    onClick={() => handleCallClick(call)}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{displayName}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(call.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={callTypeBadgeVariants[call.call_type] || "outline"} className="hidden sm:flex">
                        {callTypeLabels[call.call_type] || call.call_type}
                      </Badge>
                      {call.needs_review && (
                        <Badge variant="destructive" className="text-xs">
                          Review
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CallDetailsDialog
        call={selectedCall}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isAdmin={false}
      />
    </div>
  );
};