import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, Phone, Calendar, DollarSign, TrendingUp, MessageSquare, UserPlus, Download, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, subDays, startOfDay, endOfDay, parseISO, startOfYear } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Business {
  id: string;
  business_name: string;
  status?: string;
  aivia_active?: boolean;
}

interface AnalyticsData {
  totalBusinesses: number;
  totalStaff: number;
  totalCalls: number;
  totalBookings: number;
  totalRevenue: number;
  businessesByTier: Record<string, number>;
  callsPerBusiness: Array<{ business_name: string; count: number }>;
  messagesPerBusiness: Array<{ business_name: string; count: number }>;
  recentSignups: Array<{ id: string; business_name: string; created_at: string; status: string }>;
  topActiveBusinesses: Array<{ business_name: string; bookingCount: number }>;
}

export const AdminAnalyticsDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>("all");
  const [data, setData] = useState<AnalyticsData>({
    totalBusinesses: 0,
    totalStaff: 0,
    totalCalls: 0,
    totalBookings: 0,
    totalRevenue: 0,
    businessesByTier: {},
    callsPerBusiness: [],
    messagesPerBusiness: [],
    recentSignups: [],
    topActiveBusinesses: [],
  });

  // Fetch businesses list
  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data: businessList } = await supabase
        .from("businesses")
        .select("id, business_name, status, aivia_active")
        .order("business_name");
      
      setBusinesses(businessList || []);
    };
    fetchBusinesses();
  }, []);

  const getDateRange = (): { startDate: string; endDate: string } => {
    const endDate = endOfDay(new Date()).toISOString();
    
    if (datePreset === "custom" && customDateRange?.from) {
      return {
        startDate: startOfDay(customDateRange.from).toISOString(),
        endDate: customDateRange.to ? endOfDay(customDateRange.to).toISOString() : endDate,
      };
    }
    
    let startDate: Date;
    
    switch (datePreset) {
      case "0": // Today
        startDate = startOfDay(new Date());
        break;
      case "7": // Last 7 days
        startDate = startOfDay(subDays(new Date(), 7));
        break;
      case "30": // Last 30 days
        startDate = startOfDay(subDays(new Date(), 30));
        break;
      case "ytd": // Year to date
        startDate = startOfYear(new Date());
        break;
      default:
        startDate = startOfDay(subDays(new Date(), 30));
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate,
    };
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const isFiltered = selectedBusiness !== "all";

      // Build queries with optional business filter
      let businessesQuery = supabase.from("businesses").select("id, business_name, plan_tier, status, created_at, aivia_active");
      let staffQuery = supabase.from("staff").select("id, business_id");
      let callsQuery = supabase.from("calls_log").select("id, business_id, created_at").gte("created_at", startDate).lte("created_at", endDate);
      let bookingsQuery = supabase.from("bookings").select("id, business_id, start_time, service_id").gte("start_time", startDate).lte("start_time", endDate);
      let messagesQuery = supabase.from("messages").select("id, business_id, created_at").gte("created_at", startDate).lte("created_at", endDate);

      // Apply business filter if selected
      if (isFiltered) {
        businessesQuery = businessesQuery.eq("id", selectedBusiness);
        staffQuery = staffQuery.eq("business_id", selectedBusiness);
        callsQuery = callsQuery.eq("business_id", selectedBusiness);
        bookingsQuery = bookingsQuery.eq("business_id", selectedBusiness);
        messagesQuery = messagesQuery.eq("business_id", selectedBusiness);
      }


      // Fetch all data in parallel
      const [
        businessesResult,
        staffResult,
        callsResult,
        bookingsResult,
        messagesResult,
      ] = await Promise.all([
        businessesQuery,
        staffQuery,
        callsQuery,
        bookingsQuery,
        messagesQuery,
      ]);

      const businessesData = businessesResult.data || [];
      const staff = staffResult.data || [];
      const calls = callsResult.data || [];
      const bookings = bookingsResult.data || [];
      const messages = messagesResult.data || [];

      // Get services for revenue calculation
      const serviceIds = [...new Set(bookings.filter(b => b.service_id).map(b => b.service_id as string))];
      const { data: services } = await supabase
        .from("services")
        .select("id, price")
        .in("id", serviceIds.length > 0 ? serviceIds : ["00000000-0000-0000-0000-000000000000"]);

      const serviceMap = new Map((services || []).map(s => [s.id, s.price]));

      // Calculate total revenue
      let totalRevenue = 0;
      bookings.forEach(b => {
        if (b.service_id && serviceMap.has(b.service_id)) {
          totalRevenue += Number(serviceMap.get(b.service_id)) || 0;
        }
      });

      // Businesses by tier
      const businessesByTier: Record<string, number> = {};
      businessesData.forEach(b => {
        const tier = b.plan_tier || "tier_1";
        businessesByTier[tier] = (businessesByTier[tier] || 0) + 1;
      });

      // Calls per business - build name lookup
      const businessIdToName = new Map<string, string>();
      businessesData.forEach(b => businessIdToName.set(b.id, b.business_name));
      
      // For single business view, we need full business list for name lookup
      if (isFiltered && businesses.length > 0) {
        businesses.forEach(b => businessIdToName.set(b.id, b.business_name));
      }
      
      const callCounts: Record<string, number> = {};
      calls.forEach(c => {
        const name = businessIdToName.get(c.business_id) || "Unknown";
        callCounts[name] = (callCounts[name] || 0) + 1;
      });
      const callsPerBusiness = Object.entries(callCounts)
        .map(([business_name, count]) => ({ business_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Messages per business
      const messageCounts: Record<string, number> = {};
      messages.forEach(m => {
        const name = businessIdToName.get(m.business_id) || "Unknown";
        messageCounts[name] = (messageCounts[name] || 0) + 1;
      });
      const messagesPerBusiness = Object.entries(messageCounts)
        .map(([business_name, count]) => ({ business_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent signups (last 10)
      const recentSignups = businessesData
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(b => ({
          id: b.id,
          business_name: b.business_name,
          created_at: b.created_at,
          status: b.status,
        }));

      // Top 10 most active businesses by bookings
      const bookingCounts: Record<string, number> = {};
      bookings.forEach(b => {
        const name = businessIdToName.get(b.business_id) || "Unknown";
        bookingCounts[name] = (bookingCounts[name] || 0) + 1;
      });
      const topActiveBusinesses = Object.entries(bookingCounts)
        .map(([business_name, bookingCount]) => ({ business_name, bookingCount }))
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, 10);

      setData({
        totalBusinesses: businessesData.length,
        totalStaff: staff.length,
        totalCalls: calls.length,
        totalBookings: bookings.length,
        totalRevenue,
        businessesByTier,
        callsPerBusiness,
        messagesPerBusiness,
        recentSignups,
        topActiveBusinesses,
      });
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [datePreset, customDateRange, selectedBusiness]);

  // Export to CSV
  const exportToCSV = () => {
    try {
      const { startDate, endDate } = getDateRange();
      const dateRangeStr = `${format(new Date(startDate), "yyyy-MM-dd")}_to_${format(new Date(endDate), "yyyy-MM-dd")}`;
      
      let csvContent = "Analytics Report\n";
      csvContent += `Date Range: ${format(new Date(startDate), "MMM d, yyyy")} - ${format(new Date(endDate), "MMM d, yyyy")}\n`;
      csvContent += `Generated: ${format(new Date(), "MMM d, yyyy HH:mm")}\n\n`;
      
      // Summary metrics
      csvContent += "Summary Metrics\n";
      csvContent += `Total Businesses,${data.totalBusinesses}\n`;
      csvContent += `Total Staff,${data.totalStaff}\n`;
      csvContent += `Total Calls,${data.totalCalls}\n`;
      csvContent += `Total Bookings,${data.totalBookings}\n`;
      csvContent += `Total Revenue,${formatCurrency(data.totalRevenue)}\n\n`;
      
      // Calls by business
      if (data.callsPerBusiness.length > 0) {
        csvContent += "Calls by Business\n";
        csvContent += "Business Name,Call Count\n";
        data.callsPerBusiness.forEach(item => {
          csvContent += `"${item.business_name}",${item.count}\n`;
        });
        csvContent += "\n";
      }
      
      // Messages by business
      if (data.messagesPerBusiness.length > 0) {
        csvContent += "Messages by Business\n";
        csvContent += "Business Name,Message Count\n";
        data.messagesPerBusiness.forEach(item => {
          csvContent += `"${item.business_name}",${item.count}\n`;
        });
        csvContent += "\n";
      }
      
      // Top active businesses
      if (data.topActiveBusinesses.length > 0) {
        csvContent += "Top Active Businesses\n";
        csvContent += "Business Name,Booking Count\n";
        data.topActiveBusinesses.forEach(item => {
          csvContent += `"${item.business_name}",${item.bookingCount}\n`;
        });
        csvContent += "\n";
      }
      
      // Recent signups
      if (data.recentSignups.length > 0) {
        csvContent += "Recent Signups\n";
        csvContent += "Business Name,Signup Date,Status\n";
        data.recentSignups.forEach(item => {
          csvContent += `"${item.business_name}","${format(parseISO(item.created_at), "MMM d, yyyy")}",${item.status}\n`;
        });
      }
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `analytics_${dateRangeStr}.csv`;
      link.click();
      
      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const { startDate, endDate } = getDateRange();
      const dateRangeStr = `${format(new Date(startDate), "yyyy-MM-dd")}_to_${format(new Date(endDate), "yyyy-MM-dd")}`;
      
      const doc = new jsPDF();
      let yPos = 20;
      
      // Title
      doc.setFontSize(20);
      doc.text("Analytics Report", 14, yPos);
      yPos += 10;
      
      // Date range
      doc.setFontSize(10);
      doc.text(`Date Range: ${format(new Date(startDate), "MMM d, yyyy")} - ${format(new Date(endDate), "MMM d, yyyy")}`, 14, yPos);
      yPos += 5;
      doc.text(`Generated: ${format(new Date(), "MMM d, yyyy HH:mm")}`, 14, yPos);
      yPos += 15;
      
      // Summary metrics table
      doc.setFontSize(14);
      doc.text("Summary Metrics", 14, yPos);
      yPos += 5;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Metric", "Value"]],
        body: [
          ["Total Businesses", data.totalBusinesses.toString()],
          ["Total Staff", data.totalStaff.toString()],
          ["Total Calls", data.totalCalls.toString()],
          ["Total Bookings", data.totalBookings.toString()],
          ["Total Revenue", formatCurrency(data.totalRevenue)],
        ],
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // Calls by business
      if (data.callsPerBusiness.length > 0) {
        doc.setFontSize(14);
        doc.text("Calls by Business", 14, yPos);
        yPos += 5;
        
        autoTable(doc, {
          startY: yPos,
          head: [["Business Name", "Call Count"]],
          body: data.callsPerBusiness.map(item => [item.business_name, item.count.toString()]),
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246] },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }
      
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Top active businesses
      if (data.topActiveBusinesses.length > 0) {
        doc.setFontSize(14);
        doc.text("Top Active Businesses", 14, yPos);
        yPos += 5;
        
        autoTable(doc, {
          startY: yPos,
          head: [["Business Name", "Booking Count"]],
          body: data.topActiveBusinesses.map(item => [item.business_name, item.bookingCount.toString()]),
          theme: "striped",
          headStyles: { fillColor: [59, 130, 246] },
        });
      }
      
      doc.save(`analytics_${dateRangeStr}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast.error("Failed to export PDF");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      tier_1: "Starter",
      tier_2: "Professional",
      tier_3: "Enterprise",
    };
    return labels[tier] || tier;
  };

  const handlePresetChange = (value: string) => {
    setDatePreset(value);
    if (value !== "custom") {
      setCustomDateRange(undefined);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Analytics Overview</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Business Filter */}
          <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select business" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Businesses</SelectItem>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="0">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          
          {datePreset === "custom" && (
            <DateRangePicker
              dateRange={customDateRange}
              onDateRangeChange={setCustomDateRange}
            />
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileText className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Selected Business Indicator */}
      {selectedBusiness !== "all" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            Showing data for: {businesses.find(b => b.id === selectedBusiness)?.business_name}
          </Badge>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {selectedBusiness === "all" ? "Total Businesses" : "Business"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalBusinesses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {selectedBusiness === "all" ? "Total Staff" : "Staff Members"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalStaff}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Calls Handled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(data.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Tiers - only show for "All" view */}
      {selectedBusiness === "all" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription Breakdown</CardTitle>
            <CardDescription>Businesses by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(data.businessesByTier).map(([tier, count]) => (
                <div key={tier} className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <Badge variant="secondary">{getTierLabel(tier)}</Badge>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(data.businessesByTier).length === 0 && (
                <p className="text-muted-foreground">No subscription data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Per Business */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {selectedBusiness === "all" ? "Calls by Business" : "Call Activity"}
            </CardTitle>
            <CardDescription>
              {selectedBusiness === "all" ? "Top 10 businesses by call volume" : "Calls in selected period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.callsPerBusiness.length === 0 ? (
              <p className="text-muted-foreground text-sm">No calls in selected period</p>
            ) : (
              <div className="space-y-3">
                {data.callsPerBusiness.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[200px]">{item.business_name}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Per Business */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {selectedBusiness === "all" ? "Messages by Business" : "Message Activity"}
            </CardTitle>
            <CardDescription>
              {selectedBusiness === "all" ? "Top 10 businesses by message volume" : "Messages in selected period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.messagesPerBusiness.length === 0 ? (
              <p className="text-muted-foreground text-sm">No messages in selected period</p>
            ) : (
              <div className="space-y-3">
                {data.messagesPerBusiness.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[200px]">{item.business_name}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signups - only show for "All" view */}
        {selectedBusiness === "all" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Recent Signups
              </CardTitle>
              <CardDescription>Last 10 business registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSignups.length === 0 ? (
                <p className="text-muted-foreground text-sm">No signups yet</p>
              ) : (
                <div className="space-y-3">
                  {data.recentSignups.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{item.business_name}</span>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(item.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant={item.status === "approved" ? "default" : "secondary"}>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top Active Businesses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {selectedBusiness === "all" ? "Most Active Businesses" : "Booking Activity"}
            </CardTitle>
            <CardDescription>
              {selectedBusiness === "all" ? "Top 10 by booking volume" : "Bookings in selected period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.topActiveBusinesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bookings in selected period</p>
            ) : (
              <div className="space-y-3">
                {data.topActiveBusinesses.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedBusiness === "all" && (
                        <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                      )}
                      <span className="text-sm truncate max-w-[180px]">{item.business_name}</span>
                    </div>
                    <Badge variant="secondary">{item.bookingCount} bookings</Badge>
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