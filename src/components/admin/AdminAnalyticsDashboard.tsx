import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, Phone, Calendar, DollarSign, TrendingUp, MessageSquare, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";

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
  const [dateRange, setDateRange] = useState("30");
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

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();

      // Fetch all data in parallel
      const [
        businessesResult,
        staffResult,
        callsResult,
        bookingsResult,
        messagesResult,
      ] = await Promise.all([
        supabase.from("businesses").select("id, business_name, plan_tier, status, created_at"),
        supabase.from("staff").select("id, business_id"),
        supabase.from("calls_log").select("id, business_id, created_at").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("bookings").select("id, business_id, created_at, service_id").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("messages").select("id, business_id, created_at").gte("created_at", startDate).lte("created_at", endDate),
      ]);

      const businesses = businessesResult.data || [];
      const staff = staffResult.data || [];
      const calls = callsResult.data || [];
      const bookings = bookingsResult.data || [];
      const messages = messagesResult.data || [];

      // Get services for revenue calculation
      const serviceIds = [...new Set(bookings.filter(b => b.service_id).map(b => b.service_id))];
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
      businesses.forEach(b => {
        const tier = b.plan_tier || "tier_1";
        businessesByTier[tier] = (businessesByTier[tier] || 0) + 1;
      });

      // Calls per business
      const businessIdToName = new Map(businesses.map(b => [b.id, b.business_name]));
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
      const recentSignups = businesses
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
        totalBusinesses: businesses.length,
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
  }, [dateRange]);

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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics Overview</h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total Businesses
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
              Total Staff
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

      {/* Subscription Tiers */}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Per Business */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Calls by Business
            </CardTitle>
            <CardDescription>Top 10 businesses by call volume</CardDescription>
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
              Messages by Business
            </CardTitle>
            <CardDescription>Top 10 businesses by message volume</CardDescription>
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

        {/* Recent Signups */}
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

        {/* Top Active Businesses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Most Active Businesses
            </CardTitle>
            <CardDescription>Top 10 by booking volume</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topActiveBusinesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bookings in selected period</p>
            ) : (
              <div className="space-y-3">
                {data.topActiveBusinesses.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
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
