import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Calendar, Clock, MessageSquare, AlertTriangle, LayoutDashboard, CalendarDays, Check } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { format, isToday, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { BookingDetailsDialog } from "@/components/dashboard/BookingDetailsDialog";
import { AiviaAssistantChat } from "@/components/AiviaAssistantChat";

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_by?: string | null;
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
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);

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
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(addDays(now, 30)).toISOString();

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

    // Load all bookings for calendar
    let allQuery = supabase
      .from("bookings")
      .select(`
        *,
        service:service_id(name),
        staff:staff_id(id, name)
      `)
      .eq("business_id", bizId)
      .gte("start_time", monthStart)
      .lte("start_time", monthEnd)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (sId) {
      allQuery = allQuery.eq("staff_id", sId);
    }

    const { data: allData } = await allQuery;
    setAllBookings(allData || []);

    // Load messages for this staff member
    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("business_id", bizId)
      .or(sId ? `recipient_staff_id.eq.${sId},recipient_type.eq.all` : 'recipient_type.eq.all')
      .order("created_at", { ascending: false })
      .limit(20);

    setMessages(messagesData || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff/login");
  };

  const markMessageAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);

    if (!error) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: true } : m));
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setBookingDetailsOpen(true);
  };

  const refreshBookings = () => {
    if (businessId && staffId) {
      loadStaffData(businessId, staffId);
    }
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
  const unreadMessages = messages.filter(m => !m.is_read);

  // Get bookings for selected calendar date
  const getBookingsForDate = (date: Date) => {
    return allBookings.filter(b => isSameDay(new Date(b.start_time), date));
  };

  // Get bookings for the current view
  const getCalendarBookings = () => {
    if (calendarView === "day") {
      return getBookingsForDate(calendarDate);
    } else if (calendarView === "week") {
      const start = startOfWeek(calendarDate, { weekStartsOn: 1 });
      const end = endOfWeek(calendarDate, { weekStartsOn: 1 });
      return allBookings.filter(b => {
        const bookingDate = new Date(b.start_time);
        return bookingDate >= start && bookingDate <= end;
      });
    } else {
      const start = startOfMonth(calendarDate);
      const end = endOfMonth(calendarDate);
      return allBookings.filter(b => {
        const bookingDate = new Date(b.start_time);
        return bookingDate >= start && bookingDate <= end;
      });
    }
  };

  // Get days with bookings for calendar highlighting
  const daysWithBookings = allBookings.map(b => new Date(b.start_time));

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

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 relative">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {unreadMessages.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {unreadMessages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
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
                  {urgentMessages.length > 3 && (
                    <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("messages")}>
                      View all urgent messages
                    </Button>
                  )}
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
                      {upcomingBookings.slice(0, 5).map((booking) => (
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
                      {upcomingBookings.length > 5 && (
                        <Button variant="link" className="w-full" onClick={() => setActiveTab("bookings")}>
                          View all ({upcomingBookings.length} bookings)
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Calendar</CardTitle>
                    <CardDescription>View your scheduled appointments</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={calendarView === "day" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCalendarView("day")}
                    >
                      Day
                    </Button>
                    <Button
                      variant={calendarView === "week" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCalendarView("week")}
                    >
                      Week
                    </Button>
                    <Button
                      variant={calendarView === "month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCalendarView("month")}
                    >
                      Month
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                  {/* Calendar Picker */}
                  <div className="flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={calendarDate}
                      onSelect={(date) => date && setCalendarDate(date)}
                      modifiers={{
                        hasBooking: daysWithBookings,
                      }}
                      modifiersStyles={{
                        hasBooking: { fontWeight: "bold", textDecoration: "underline" },
                      }}
                      className="rounded-md border"
                    />
                  </div>

                  {/* Bookings for selected view */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">
                      {calendarView === "day" && format(calendarDate, "EEEE, MMMM d, yyyy")}
                      {calendarView === "week" && `Week of ${format(startOfWeek(calendarDate, { weekStartsOn: 1 }), "MMM d")} - ${format(endOfWeek(calendarDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
                      {calendarView === "month" && format(calendarDate, "MMMM yyyy")}
                    </h3>
                    
                    {getCalendarBookings().length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No bookings for this {calendarView}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {getCalendarBookings().map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleBookingClick(booking)}
                          >
                            <div className="flex-shrink-0 text-center min-w-[80px]">
                              <p className="text-sm font-medium">
                                {format(new Date(booking.start_time), "MMM d")}
                              </p>
                              <p className="text-xs">
                                {format(new Date(booking.start_time), "HH:mm")} - {format(new Date(booking.end_time), "HH:mm")}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{booking.customer_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {booking.service?.name || "Service not specified"}
                              </p>
                              {booking.notes && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {booking.notes}
                                </p>
                              )}
                            </div>
                            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                              {booking.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Bookings</CardTitle>
                <CardDescription>All upcoming appointments assigned to you</CardDescription>
              </CardHeader>
              <CardContent>
                {[...todayBookings, ...upcomingBookings].length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No upcoming bookings</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...todayBookings, ...upcomingBookings].map((booking) => (
                      <div
                        key={booking.id}
                        className={`flex items-center gap-3 p-4 border rounded-lg ${isToday(new Date(booking.start_time)) ? 'bg-primary/5 border-primary/20' : ''}`}
                      >
                        <div className="flex-shrink-0 text-center min-w-[80px]">
                          <p className="text-sm font-medium">
                            {isToday(new Date(booking.start_time)) ? "Today" : format(new Date(booking.start_time), "MMM d")}
                          </p>
                          <p className="text-lg font-bold">
                            {format(new Date(booking.start_time), "HH:mm")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            to {format(new Date(booking.end_time), "HH:mm")}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{booking.customer_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.service?.name || "Service not specified"}
                          </p>
                          <p className="text-sm text-muted-foreground">{booking.customer_phone}</p>
                          {booking.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              Notes: {booking.notes}
                            </p>
                          )}
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
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Messages
                </CardTitle>
                <CardDescription>
                  {unreadMessages.length} unread • {urgentMessages.length} urgent
                </CardDescription>
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
                        className={`p-4 border rounded-lg ${msg.is_urgent ? 'border-destructive bg-destructive/5' : ''} ${!msg.is_read ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{msg.caller_name || msg.caller_phone}</p>
                              {msg.is_urgent && (
                                <Badge variant="destructive" className="text-xs">Urgent</Badge>
                              )}
                              {!msg.is_read && (
                                <Badge variant="secondary" className="text-xs">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{msg.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          {!msg.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markMessageAsRead(msg.id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Mark Read
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Booking Details Dialog */}
        <BookingDetailsDialog
          booking={selectedBooking}
          open={bookingDetailsOpen}
          onOpenChange={setBookingDetailsOpen}
          onDelete={refreshBookings}
        />

        {/* AI Assistant Chat */}
        {user && businessId && (
          <AiviaAssistantChat
            businessId={businessId}
            userId={user.id}
            role="staff"
          />
        )}
      </main>
    </div>
  );
};

export default StaffDashboard;