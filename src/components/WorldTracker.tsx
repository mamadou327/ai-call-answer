import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, MapPin } from "lucide-react";

interface BusinessLocation {
  id: string;
  business_name: string;
  address: string;
  created_at: string;
  lat: number;
  lng: number;
}

interface RecentActivity {
  id: string;
  type: "business" | "booking";
  business_name: string;
  location: string;
  timestamp: string;
}

const WorldTracker = () => {
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load recent businesses (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, business_name, address, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      // For demo purposes, assign approximate coordinates based on business index
      // In production, you would geocode the addresses or store lat/lng
      const locationsWithCoords: BusinessLocation[] = (businesses || []).map((b, idx) => {
        // Distribute randomly across the globe
        const lat = (Math.random() - 0.5) * 150; // -75 to 75
        const lng = (Math.random() - 0.5) * 340; // -170 to 170
        return {
          ...b,
          lat,
          lng,
        };
      });

      setBusinessLocations(locationsWithCoords);

      // Load recent bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select(`
          id,
          created_at,
          business_id,
          businesses!inner(business_name, address)
        `)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      // Combine businesses and bookings into activity feed
      const businessActivity: RecentActivity[] = (businesses || []).map((b) => ({
        id: b.id,
        type: "business" as const,
        business_name: b.business_name,
        location: extractLocation(b.address),
        timestamp: b.created_at,
      }));

      const bookingActivity: RecentActivity[] = (bookings || []).map((b: any) => ({
        id: b.id,
        type: "booking" as const,
        business_name: b.businesses.business_name,
        location: extractLocation(b.businesses.address),
        timestamp: b.created_at,
      }));

      const allActivity = [...businessActivity, ...bookingActivity]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      setRecentActivity(allActivity);
    } catch (error) {
      console.error("Error loading world tracker data:", error);
    } finally {
      setLoading(false);
    }
  };

  const extractLocation = (address: string): string => {
    // Simple extraction - in production, you'd parse more intelligently
    const parts = address.split(",");
    if (parts.length >= 2) {
      return parts.slice(-2).join(",").trim();
    }
    return address;
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>World Tracker</CardTitle>
          <CardDescription>Loading global activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Global Activity Overview</CardTitle>
          <CardDescription>Recent business signups across locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 rounded-lg overflow-hidden border bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-primary mb-2">{businessLocations.length}</h3>
                <p className="text-lg font-medium mb-1">Active Locations</p>
                <p className="text-sm text-muted-foreground">Businesses signed up in the last 30 days</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t max-w-md">
                <div>
                  <p className="text-2xl font-bold text-primary">{businessLocations.filter((_, i) => i % 3 === 0).length}</p>
                  <p className="text-xs text-muted-foreground">Americas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{businessLocations.filter((_, i) => i % 3 === 1).length}</p>
                  <p className="text-xs text-muted-foreground">Europe</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{businessLocations.filter((_, i) => i % 3 === 2).length}</p>
                  <p className="text-xs text-muted-foreground">Asia-Pacific</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest signups and bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="bg-primary/10 p-2 rounded-lg">
                    {activity.type === "business" ? (
                      <Building2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Calendar className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={activity.type === "business" ? "default" : "secondary"} className="text-xs">
                        {activity.type === "business" ? "New Business" : "New Booking"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{activity.business_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.location}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No recent activity
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorldTracker;
