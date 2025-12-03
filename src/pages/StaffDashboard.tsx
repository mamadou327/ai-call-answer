import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Calendar, Clock, User, MessageSquare, AlertTriangle } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { format, isToday, isFuture, startOfDay, endOfDay, addDays } from "date-fns";
import aiviaLogo from "@/assets/aivia-logo-new.png";

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  service?: { name: string } | null;
  staff?: { id: string; name: string } | null;
}

interface Message {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  content: string;
  is_urgent: boolean;
  is_read: boolean;
  created_at: string;
  recipient_staff_id: string | null;
  recipient_type: string;
}

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/staff/login");
      return;
    }

    setUser(user);

    // Check if user is staff with active membership
    const { data: membership } = await supabase
      .from("staff_memberships")
      .select("status, business_id, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      navigate("/staff/invite");
      return;
    }

    if (membership.status === "pending_approval") {
      navigate("/staff/pending");
      return;
    }

    if (membership.status === "revoked") {
      toast({
        title: "Access Revoked",
        description: "Your staff access has been revoked.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      navigate("/staff/login");
      return;
    }

    // Load business info
    const { data: business } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("id", membership.business_id)
      .single();

    if (business) {
      setBusinessName(business.business_name);
      setBusinessId(business.id);
    }

    // Find matching staff record by email or name
    const { data: staffRecords } = await supabase
      .from("staff")
      .select("id, name, email")
      .eq("business_id", membership.business_id);

    const staffRecord = staffRecords?.find(s => 
      s.email === user.email || 
      s.name === `${membership.first_name} ${membership.last_name}`.trim()
    );

    if (staffRecord) {
      setStaffId(staffRecord.id);
      setStaffName(staffRecord.name);
      await loadStaffData(membership.business_id, staffRecord.id);
    } else {
      setStaffName(`${membership.first_name || ''} ${membership.last_name || ''}`.trim());
      await loadStaffData(membership.business_id, null);
    }

    setLoading(false);
  };

  const loadStaffData = async (bizId: string, sId: string | null) => {
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekEnd = endOfDay(addDays(now, 7)).toISOString();

    // Load today's bookings
    let todayQuery = supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(id, name)
      `)
      .eq("business_id", bizId)
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (sId) {
      todayQuery = todayQuery.eq("staff_id", sId);
    }

    const { data: todayData } = await todayQuery;
    setTodayBookings(todayData || []);

    // Load upcoming bookings (next 7 days, excluding today)
    let upcomingQuery = supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(id, name)
      `)
      .eq("business_id", bizId)
      .gt("start_time", todayEnd)
      .lte("start_time", weekEnd)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(10);

    if (sId) {
      upcomingQuery = upcomingQuery.eq("staff_id", sId);
    }

    const { data: upcomingData } = await upcomingQuery;
    setUpcomingBookings(upcomingData || []);

    // Load messages for this staff member
    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("business_id", bizId)
      .or(sId ? `recipient_staff_id.eq.${sId},recipient_type.eq.all` : 'recipient_type.eq.all')
      .order("created_at", { ascending: false })
      .limit(10);

    setMessages(messagesData || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const todayStats = {
    total: todayBookings.length,
    completed: todayBookings.filter(b => new Date(b.end_time) < new Date()).length,
    remaining: todayBookings.filter(b => new Date(b.start_time) > new Date()).length,
  };

  const urgentMessages = messages.filter(m => m.is_urgent && !m.is_read);

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="font-orbitron font-bold text-2xl">Aivia</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <p className="font-medium">{staffName}</p>
              <p className="text-muted-foreground">{businessName}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.remaining}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.total + upcomingBookings.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Urgent Messages Alert */}
        {urgentMessages.length > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                Urgent Messages ({urgentMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {urgentMessages.slice(0, 3).map((msg) => (
                <div key={msg.id} className="text-sm">
                  <p className="font-medium">{msg.caller_name || msg.caller_phone}</p>
                  <p className="text-muted-foreground line-clamp-1">{msg.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Today's Schedule
              </CardTitle>
              <CardDescription>
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No bookings scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-shrink-0 text-center">
                        <p className="text-lg font-bold">
                          {format(new Date(booking.start_time), "HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.end_time), "HH:mm")}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {booking.service?.name || "Service not specified"}
                        </p>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Upcoming Bookings
              </CardTitle>
              <CardDescription>Next 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-shrink-0 text-center min-w-[60px]">
                        <p className="text-sm font-medium">
                          {format(new Date(booking.start_time), "MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.start_time), "HH:mm")}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {booking.service?.name || "Service not specified"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Messages
            </CardTitle>
            <CardDescription>Messages left for you</CardDescription>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No messages</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 border rounded-lg ${msg.is_urgent ? 'border-destructive bg-destructive/5' : ''} ${!msg.is_read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{msg.caller_name || msg.caller_phone}</p>
                          {msg.is_urgent && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{msg.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StaffDashboard;