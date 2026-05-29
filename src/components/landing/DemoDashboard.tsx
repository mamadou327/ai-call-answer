import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  CalendarDays, 
  Phone, 
  MessageSquare,
  Clock,
  ChefHat,
  Package,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  Plus,
  UtensilsCrossed,
  Shuffle,
  CalendarCheck,
  HelpCircle,
  ChevronRight,
  Calendar,
  Scissors,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DEMO_ORDERS, 
  DEMO_RESERVATIONS, 
  DEMO_RESTAURANT_CALLS, 
  DEMO_RESTAURANT_MESSAGES,
  DEMO_RESTAURANT_STATS,
  DEMO_DINEIN_CALLS,
  DEMO_DINEIN_MESSAGES,
  DEMO_RESERVATION_STATS,
  DEMO_TODAYS_APPOINTMENTS,
  DEMO_SALON_CALLS,
  DEMO_SALON_MESSAGES,
  DEMO_SALON_STATS,
  DEMO_SPA_APPOINTMENTS,
  DEMO_SPA_CALLS,
  DEMO_SPA_MESSAGES,
  DEMO_SPA_STATS,
} from "@/lib/demoData";
import { format, formatDistanceToNow } from "date-fns";

// Call type configuration matching real CallsTab
const callTypeLabels: Record<string, string> = {
  new_booking: "Booking Created",
  new_order: "Order Created",
  new_reservation: "Reservation",
  reschedule: "Reschedule",
  cancel: "Cancellation",
  question: "General Enquiry",
  complaint: "Complaint",
  other: "Other",
};

const callTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_booking: "default",
  new_order: "default",
  new_reservation: "default",
  reschedule: "secondary",
  cancel: "destructive",
  question: "outline",
  complaint: "destructive",
  other: "outline",
};

type DemoOrder = typeof DEMO_ORDERS[0];
type DemoReservation = typeof DEMO_RESERVATIONS[0];
type DemoAppointment = typeof DEMO_TODAYS_APPOINTMENTS[0] & { staff: { name: string; room?: string } };
type DemoBusinessType = "takeaway" | "dinein" | "hybrid" | "salon" | "spa";

interface BusinessConfig {
  name: string;
  subtitle: string;
}

const businessConfigs: Record<DemoBusinessType, BusinessConfig> = {
  takeaway: {
    name: "Fresh Bites",
    subtitle: "Takeaway Restaurant Demo"
  },
  dinein: {
    name: "The Golden Table",
    subtitle: "Dine-in Restaurant Demo"
  },
  hybrid: {
    name: "Bella's Kitchen",
    subtitle: "Hybrid Restaurant Demo"
  },
  salon: {
    name: "Luxe Hair Studio",
    subtitle: "Salon & Barbershop Demo"
  },
  spa: {
    name: "Serenity Spa",
    subtitle: "Spa & Wellness Demo"
  }
};

// Status config matching RestaurantOrderQueue
const orderStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  pending: { 
    label: "Pending", 
    color: "text-yellow-700", 
    icon: <Clock className="w-4 h-4" />,
    bgColor: "bg-yellow-50 border-yellow-200"
  },
  confirmed: { 
    label: "Confirmed", 
    color: "text-blue-700", 
    icon: <CheckCircle className="w-4 h-4" />,
    bgColor: "bg-blue-50 border-blue-200"
  },
  preparing: { 
    label: "Preparing", 
    color: "text-orange-700", 
    icon: <ChefHat className="w-4 h-4" />,
    bgColor: "bg-orange-50 border-orange-200"
  },
  ready: { 
    label: "Ready", 
    color: "text-green-700", 
    icon: <Package className="w-4 h-4" />,
    bgColor: "bg-green-50 border-green-200"
  },
};

const ReservationCard = ({ reservation, onClick }: { reservation: DemoReservation; onClick: () => void }) => {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    confirmed: { label: "Confirmed", variant: "secondary" },
    seated: { label: "Seated", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const status = statusConfig[reservation.status] || statusConfig.pending;
  const reservationTime = new Date(reservation.reservation_time);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-sm">{reservation.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              {format(reservationTime, 'HH:mm')}
            </p>
          </div>
          <Badge variant={status.variant} className="text-[10px] px-1.5 py-0.5">
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><Users className="w-3 h-3 inline mr-1" />{reservation.party_size}</span>
          <span>Table {reservation.table.table_number}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const DemoDashboard = () => {
  const [selectedType, setSelectedType] = useState<DemoBusinessType>("hybrid");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [phoneTab, setPhoneTab] = useState("dashboard");
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<DemoReservation | null>(null);
  const [dateRange, setDateRange] = useState("today");
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get config based on selected type
  const businessConfig = businessConfigs[selectedType];

  const isAppointmentBased = selectedType === "salon" || selectedType === "spa";

  // Appointments dataset for salon/spa
  const appointments: DemoAppointment[] = selectedType === "salon"
    ? (DEMO_TODAYS_APPOINTMENTS as DemoAppointment[])
    : selectedType === "spa"
    ? (DEMO_SPA_APPOINTMENTS as DemoAppointment[])
    : [];

  // Get stats based on type
  const stats = selectedType === "dinein"
    ? DEMO_RESERVATION_STATS
    : selectedType === "salon"
    ? DEMO_SALON_STATS
    : selectedType === "spa"
    ? DEMO_SPA_STATS
    : DEMO_RESTAURANT_STATS;

  // Get calls and messages based on type
  const calls = selectedType === "dinein"
    ? DEMO_DINEIN_CALLS
    : selectedType === "salon"
    ? DEMO_SALON_CALLS
    : selectedType === "spa"
    ? DEMO_SPA_CALLS
    : DEMO_RESTAURANT_CALLS;
  const messages = selectedType === "dinein"
    ? DEMO_DINEIN_MESSAGES
    : selectedType === "salon"
    ? DEMO_SALON_MESSAGES
    : selectedType === "spa"
    ? DEMO_SPA_MESSAGES
    : DEMO_RESTAURANT_MESSAGES;

  // Calculate call stats derived from dashboard stats for consistency
  const callStats = isAppointmentBased
    ? {
        totalCalls: Math.round((stats as typeof DEMO_SALON_STATS).appointmentsCount * 1.5),
        bookingsCreated: (stats as typeof DEMO_SALON_STATS).appointmentsCount,
        enquiries: 3,
        cancellations: (stats as typeof DEMO_SALON_STATS).cancelledCount,
      }
    : {
        totalCalls: selectedType === "dinein"
          ? Math.round(DEMO_RESERVATION_STATS.reservationsCount * 0.8)
          : Math.round(DEMO_RESTAURANT_STATS.ordersCount * 0.75),
        bookingsCreated: selectedType === "dinein"
          ? DEMO_RESERVATION_STATS.reservationsCount
          : Math.round(DEMO_RESTAURANT_STATS.ordersCount * 0.85),
        enquiries: selectedType === "dinein" ? 3 : 4,
        cancellations: selectedType === "dinein"
          ? DEMO_RESERVATION_STATS.cancelledCount
          : DEMO_RESTAURANT_STATS.cancelledCount,
      };

  // Show orders for takeaway and hybrid
  const showOrders = selectedType === "takeaway" || selectedType === "hybrid";
  // Show reservations for dinein and hybrid
  const showReservations = selectedType === "dinein" || selectedType === "hybrid";
  // Show appointments for salon and spa
  const showAppointments = isAppointmentBased;

  // Normalized stat-card view (4 cards)
  const statView = isAppointmentBased
    ? {
        primaryLabel: "Appointments",
        primaryValue: (stats as typeof DEMO_SALON_STATS).appointmentsCount,
        secondaryLabel: "Completed",
        secondaryValue: (stats as typeof DEMO_SALON_STATS).completedCount,
        cancelledValue: (stats as typeof DEMO_SALON_STATS).cancelledCount,
        lastLabel: "Revenue",
        lastValue: `£${(stats as typeof DEMO_SALON_STATS).revenue.toFixed(2)}`,
        lastValueShort: `£${(stats as typeof DEMO_SALON_STATS).revenue.toFixed(0)}`,
        lastIcon: "money" as const,
      }
    : selectedType === "dinein"
    ? {
        primaryLabel: "Reservations",
        primaryValue: DEMO_RESERVATION_STATS.reservationsCount,
        secondaryLabel: "Seated",
        secondaryValue: DEMO_RESERVATION_STATS.reservationsCount - DEMO_RESERVATION_STATS.cancelledCount,
        cancelledValue: DEMO_RESERVATION_STATS.cancelledCount,
        lastLabel: "Total Covers",
        lastValue: String(DEMO_RESERVATION_STATS.totalCovers),
        lastValueShort: String(DEMO_RESERVATION_STATS.totalCovers),
        lastIcon: "users" as const,
      }
    : {
        primaryLabel: "Total Orders",
        primaryValue: DEMO_RESTAURANT_STATS.ordersCount,
        secondaryLabel: "Completed",
        secondaryValue: DEMO_RESTAURANT_STATS.completedCount,
        cancelledValue: DEMO_RESTAURANT_STATS.cancelledCount,
        lastLabel: "Revenue",
        lastValue: `£${DEMO_RESTAURANT_STATS.revenue.toFixed(2)}`,
        lastValueShort: `£${DEMO_RESTAURANT_STATS.revenue.toFixed(0)}`,
        lastIcon: "money" as const,
      };

  // Group orders by status for the kanban queue
  const activeOrders = DEMO_ORDERS.filter(o => ["pending", "confirmed", "preparing", "ready"].includes(o.status));
  const groupedOrders = {
    pending: activeOrders.filter(o => o.status === "pending"),
    confirmed: activeOrders.filter(o => o.status === "confirmed"),
    preparing: activeOrders.filter(o => o.status === "preparing"),
    ready: activeOrders.filter(o => o.status === "ready"),
  };

  const getOrderItems = (items: any): { name: string; quantity: number }[] => {
    if (!items) return [];
    if (Array.isArray(items)) {
      return items.map((item: any) => ({
        name: item.name || item.item_name || "Unknown",
        quantity: item.quantity || 1,
      }));
    }
    return [];
  };

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      default: return "Today";
    }
  };

  // Reset to dashboard tab when switching types
  const handleTypeChange = (type: DemoBusinessType) => {
    setSelectedType(type);
    setActiveTab("dashboard");
    setPhoneTab("dashboard");
  };

  // Desktop tab count: dashboard + calls + messages + optional (orders | reservations | appointments)
  const desktopTabsCount = 3
    + (showOrders ? 1 : 0)
    + (showReservations ? 1 : 0)
    + (showAppointments ? 1 : 0);

  return (
    <div className="relative mt-16">
      {/* Business Type Selector */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1rem)] sm:w-auto flex justify-center">
        <div className="flex items-center gap-1 sm:gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-full p-1 shadow-lg flex-wrap justify-center max-w-full">
          <Button
            variant={selectedType === "takeaway" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange("takeaway")}
            className="rounded-full gap-1.5 text-xs h-8 px-3"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Takeaway
          </Button>
          <Button
            variant={selectedType === "dinein" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange("dinein")}
            className="rounded-full gap-1.5 text-xs h-8 px-3"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Dine-in
          </Button>
          <Button
            variant={selectedType === "hybrid" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange("hybrid")}
            className="rounded-full gap-1.5 text-xs h-8 px-3"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Hybrid
          </Button>
          <Button
            variant={selectedType === "salon" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange("salon")}
            className="rounded-full gap-1.5 text-xs h-8 px-3"
          >
            <Scissors className="w-3.5 h-3.5" />
            Salon
          </Button>
          <Button
            variant={selectedType === "spa" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTypeChange("spa")}
            className="rounded-full gap-1.5 text-xs h-8 px-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Spa
          </Button>
        </div>
      </div>


      {/* Phone Mockup - Mobile Dashboard - Show on mobile, hide on desktop */}
      <div className="block md:hidden mx-auto max-w-[280px] mb-8 relative">
        {/* Realistic iPhone-style frame */}
        <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[40px] p-[10px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)_inset]">
          {/* Side buttons - Volume */}
          <div className="absolute -left-[2px] top-24 w-[3px] h-8 bg-zinc-700 rounded-l-sm" />
          <div className="absolute -left-[2px] top-36 w-[3px] h-8 bg-zinc-700 rounded-l-sm" />
          {/* Side button - Power */}
          <div className="absolute -right-[2px] top-28 w-[3px] h-12 bg-zinc-700 rounded-r-sm" />
          
          {/* Inner screen bezel */}
          <div className="bg-black rounded-[32px] overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20 flex items-center justify-center gap-3">
              <div className="w-3 h-3 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
              <div className="w-2 h-2 rounded-full bg-zinc-700" />
            </div>
            
            {/* Screen content */}
            <div className="bg-background rounded-[32px] overflow-hidden">
              {/* Status Bar */}
              <div className="px-6 pt-3 pb-1 flex justify-between items-center text-[11px]">
                <span className="font-semibold">{currentTime}</span>
                <div className="w-[90px]" /> {/* Space for dynamic island */}
                <div className="flex gap-1.5 items-center">
                  <svg className="w-4 h-3" viewBox="0 0 17 10" fill="currentColor">
                    <rect x="0" y="3" width="3" height="7" rx="0.5" fillOpacity="0.3"/>
                    <rect x="4" y="2" width="3" height="8" rx="0.5" fillOpacity="0.5"/>
                    <rect x="8" y="1" width="3" height="9" rx="0.5" fillOpacity="0.7"/>
                    <rect x="12" y="0" width="3" height="10" rx="0.5"/>
                  </svg>
                  <svg className="w-4 h-3" viewBox="0 0 15 11" fill="currentColor">
                    <path d="M7.5 2.5c2.5 0 4.5 1 6 2.5-.3.4-.6.7-1 1-1.2-1.2-2.9-2-5-2s-3.8.8-5 2c-.4-.3-.7-.6-1-1 1.5-1.5 3.5-2.5 6-2.5z" fillOpacity="0.4"/>
                    <path d="M7.5 5c1.7 0 3.2.7 4.3 1.7-.3.4-.6.7-1 1-.8-.7-1.9-1.2-3.3-1.2s-2.5.5-3.3 1.2c-.4-.3-.7-.6-1-1C4.3 5.7 5.8 5 7.5 5z" fillOpacity="0.7"/>
                    <circle cx="7.5" cy="9" r="1.5"/>
                  </svg>
                  <div className="w-6 h-3 border border-current rounded-[3px] relative">
                    <div className="absolute inset-[2px] right-[4px] bg-current rounded-[1px]" />
                    <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[2px] h-1.5 bg-current rounded-r-sm" />
                  </div>
                </div>
              </div>
              
              {/* App Content */}
              <div className="p-3 pt-1 space-y-3 min-h-[420px]">
                {/* App Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div>
                    <div className="text-sm font-bold">{businessConfig.name}</div>
                    <div className="text-[10px] text-muted-foreground">{businessConfig.subtitle}</div>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-2 py-0.5 h-5 gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Active
                  </Badge>
                </div>
                
                {/* Tab Bar */}
                <div className={`flex gap-1 bg-muted rounded-lg p-1`}>
                  <button 
                    onClick={() => setPhoneTab("dashboard")}
                    className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "dashboard" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 mx-auto mb-0.5" />
                    <span>Home</span>
                  </button>
                  {showOrders && (
                    <button 
                      onClick={() => setPhoneTab("orders")}
                      className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "orders" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 mx-auto mb-0.5" />
                      <span>Orders</span>
                    </button>
                  )}
                  {showReservations && (
                    <button 
                      onClick={() => setPhoneTab("tables")}
                      className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "tables" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <CalendarDays className="w-3.5 h-3.5 mx-auto mb-0.5" />
                      <span>Tables</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setPhoneTab("calls")}
                    className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "calls" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Phone className="w-3.5 h-3.5 mx-auto mb-0.5" />
                    <span>Calls</span>
                  </button>
                  <button 
                    onClick={() => setPhoneTab("messages")}
                    className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "messages" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mx-auto mb-0.5" />
                    <span>Msgs</span>
                  </button>
                </div>
                
                {/* Tab Content */}
                {phoneTab === "dashboard" && (
                  <div className="space-y-3">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <Card className="border-border/50 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{statView.primaryLabel}</span>
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="text-lg font-bold">{statView.primaryValue}</div>
                      </Card>
                      <Card className="border-border/50 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{statView.secondaryLabel}</span>
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        </div>
                        <div className="text-lg font-bold text-green-600">{statView.secondaryValue}</div>
                      </Card>
                      <Card className="border-border/50 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Cancelled</span>
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        </div>
                        <div className="text-lg font-bold text-destructive">{statView.cancelledValue}</div>
                      </Card>
                      <Card className="border-border/50 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{statView.lastLabel}</span>
                          {statView.lastIcon === "users" ? (
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-lg font-bold">{statView.lastValueShort}</div>
                      </Card>
                    </div>

                    {/* Today's Appointments - salon/spa */}
                    {showAppointments && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">Today's Appointments</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                            {appointments.length} booked
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {appointments.slice(0, 2).map((apt) => (
                            <Card key={apt.id} className="border-border/50 p-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium">{apt.customer_name}</div>
                                <div className="text-[10px]">{format(new Date(apt.start_time), 'HH:mm')}</div>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1 truncate">
                                {apt.service.name} • {apt.staff.name}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    
                    {/* Active Section - Orders for takeaway/hybrid */}
                    {showOrders && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">Active Orders</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                            {activeOrders.length} active
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {activeOrders.slice(0, selectedType === "hybrid" ? 1 : 2).map((order) => (
                            <Card key={order.id} className={`p-2 border ${orderStatusConfig[order.status].bgColor}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={orderStatusConfig[order.status].color}>
                                    {orderStatusConfig[order.status].icon}
                                  </span>
                                  <span className="text-xs font-bold">#{order.order_number}</span>
                                </div>
                                <span className="text-xs font-medium">£{order.total.toFixed(2)}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">{order.customer_name}</div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reservations Section - for dinein/hybrid */}
                    {showReservations && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">Today's Tables</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                            {DEMO_RESERVATIONS.length} bookings
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {DEMO_RESERVATIONS.slice(0, selectedType === "hybrid" ? 1 : 2).map((res, i) => (
                            <Card key={i} className="border-border/50 p-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium">{res.customer_name}</div>
                                <div className="text-[10px]">{format(new Date(res.reservation_time), 'HH:mm')}</div>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                <Users className="w-3 h-3" />
                                <span>{res.party_size} guests</span>
                                <span>• Table {res.table.table_number}</span>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {phoneTab === "orders" && showOrders && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">Order Queue</div>
                    <div className="space-y-1.5">
                      {activeOrders.slice(0, 4).map((order) => (
                        <Card key={order.id} className={`p-2 border ${orderStatusConfig[order.status].bgColor}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={orderStatusConfig[order.status].color}>
                                {orderStatusConfig[order.status].icon}
                              </span>
                              <span className="text-xs font-bold">#{order.order_number}</span>
                            </div>
                            <Badge variant="outline" className="text-[9px]">
                              {orderStatusConfig[order.status].label}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[10px] text-muted-foreground">{order.customer_name}</div>
                            <span className="text-xs font-medium">£{order.total.toFixed(2)}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {phoneTab === "tables" && showReservations && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">Today's Reservations</div>
                    <div className="space-y-1.5">
                      {DEMO_RESERVATIONS.slice(0, 4).map((res, i) => (
                        <Card key={i} className="border-border/50 p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">{res.customer_name}</div>
                            <div className="text-[10px]">{format(new Date(res.reservation_time), 'HH:mm')}</div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                            <Users className="w-3 h-3" />
                            <span>{res.party_size} guests</span>
                            <span>• Table {res.table.table_number}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {phoneTab === "calls" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Recent Calls</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5">{calls.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {calls.slice(0, 4).map((call, i) => (
                        <Card key={i} className="border-border/50 p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">{call.caller_name || call.caller_phone}</div>
                            <Badge 
                              variant={callTypeBadgeVariants[call.call_type] || "outline"} 
                              className="text-[9px] px-1.5"
                            >
                              {callTypeLabels[call.call_type] || call.call_type}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{call.summary}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {phoneTab === "messages" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Messages</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5">{messages.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {messages.slice(0, 4).map((msg, i) => (
                        <Card key={i} className="border-border/50 p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">{msg.caller_name || msg.caller_phone}</div>
                            {msg.is_urgent && (
                              <Badge variant="destructive" className="text-[9px] px-1.5">Urgent</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{msg.content}</div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Home Indicator */}
              <div className="flex justify-center pb-2 pt-1">
                <div className="w-28 h-1 bg-foreground/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Laptop with Floating Phone Overlay */}
      <div className="hidden md:block max-w-4xl mx-auto relative">
        {/* Laptop Frame */}
        <div className="relative">
        <div className="relative bg-muted border-2 border-border rounded-t-xl pt-4 px-4 pb-0">
          {/* Browser Chrome */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 bg-background rounded-md px-3 py-1 text-xs text-muted-foreground text-center">
              aivia.app/dashboard
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="bg-background rounded-t-lg border border-b-0 border-border overflow-hidden">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{businessConfig.name}</h2>
                  <p className="text-xs text-muted-foreground">{businessConfig.subtitle}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                  AIVIA Active
                </Badge>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={`grid w-full h-9 ${selectedType === "hybrid" ? "grid-cols-5" : "grid-cols-4"}`}>
                  <TabsTrigger value="dashboard" className="text-xs gap-1">
                    <LayoutDashboard className="w-3 h-3" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  {showOrders && (
                    <TabsTrigger value="orders" className="text-xs gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      <span className="hidden sm:inline">Orders</span>
                    </TabsTrigger>
                  )}
                  {showReservations && (
                    <TabsTrigger value="reservations" className="text-xs gap-1">
                      <CalendarDays className="w-3 h-3" />
                      <span className="hidden sm:inline">Tables</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="calls" className="text-xs gap-1">
                    <Phone className="w-3 h-3" />
                    <span className="hidden sm:inline">Calls</span>
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="text-xs gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="hidden sm:inline">Messages</span>
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[300px] mt-4">
                  {/* Dashboard Tab */}
                  <TabsContent value="dashboard" className="mt-0 space-y-4">
                    {/* Date Range & Manual Order Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Analytics</h3>
                      <div className="flex gap-2 items-center">
                        {showOrders && (
                          <Button size="sm" className="h-7 text-xs gap-1" variant="default">
                            <Plus className="w-3 h-3" />
                            Manual Order
                          </Button>
                        )}
                        <Select value={dateRange} onValueChange={setDateRange}>
                          <SelectTrigger className="w-[100px] h-7 text-xs" aria-label="Select date range">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-4 gap-2">
                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">{statView.primaryLabel}</CardTitle>
                          <Package className="w-3 h-3 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">{statView.primaryValue}</div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">{statView.secondaryLabel}</CardTitle>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-green-600">{statView.secondaryValue}</div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Cancelled</CardTitle>
                          <XCircle className="w-3 h-3 text-destructive" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-destructive">{statView.cancelledValue}</div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">{statView.lastLabel}</CardTitle>
                          {statView.lastIcon === "users" ? (
                            <Users className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                          )}
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">{statView.lastValue}</div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Today's Appointments - Only for salon and spa */}
                    {showAppointments && (
                      <Card className="border-border/50">
                        <CardHeader className="p-2 pb-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Today's Appointments</CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {appointments.length} booked
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="grid grid-cols-2 gap-2">
                            {appointments.slice(0, 4).map((apt) => (
                              <Card key={apt.id} className="border-border/50">
                                <CardContent className="p-2.5">
                                  <div className="flex items-start justify-between mb-1">
                                    <div>
                                      <p className="font-semibold text-xs">{apt.customer_name}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {format(new Date(apt.start_time), 'HH:mm')} • {apt.staff.name}
                                        {apt.staff.room ? ` • ${apt.staff.room}` : ''}
                                      </p>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                      £{apt.service.price}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate">{apt.service.name}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}


                    {/* Active Orders Queue - Only for takeaway and hybrid */}
                    {showOrders && (
                      <Card className="border-border/50">
                        <CardHeader className="p-2 pb-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Active Orders</CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {activeOrders.length} active
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="grid grid-cols-4 gap-2">
                            {(["pending", "confirmed", "preparing", "ready"] as const).map((status) => (
                              <div key={status} className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className={`${orderStatusConfig[status].color}`}>
                                    {orderStatusConfig[status].icon}
                                  </span>
                                  <span className={`text-[10px] font-medium ${orderStatusConfig[status].color}`}>
                                    {orderStatusConfig[status].label}
                                  </span>
                                  <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0">
                                    {groupedOrders[status].length}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-1 min-h-[60px]">
                                  {groupedOrders[status].slice(0, 1).map((order) => {
                                    const items = getOrderItems(order.items);
                                    return (
                                      <div 
                                        key={order.id} 
                                        className={`p-1.5 rounded-md border cursor-pointer hover:shadow-sm transition-shadow ${orderStatusConfig[status].bgColor}`}
                                        onClick={() => setSelectedOrder(order)}
                                      >
                                        <div className="flex items-start justify-between mb-0.5">
                                          <p className="font-bold text-xs">#{order.order_number}</p>
                                          <p className="font-medium text-[10px]">
                                            £{order.total.toFixed(2)}
                                          </p>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground mb-0.5">{order.customer_name}</p>
                                        <p className="text-[8px] text-muted-foreground truncate">
                                          {items.slice(0, 2).map(i => `${i.quantity}x ${i.name}`).join(", ")}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Reservations Section - Only for dinein and hybrid */}
                    {showReservations && (
                      <Card className="border-border/50">
                        <CardHeader className="p-2 pb-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Today's Reservations</CardTitle>
                            <Badge variant="secondary" className="text-[10px]">
                              {DEMO_RESERVATIONS.length} bookings
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="grid grid-cols-2 gap-2">
                            {DEMO_RESERVATIONS.slice(0, selectedType === "hybrid" ? 2 : 4).map((reservation) => (
                              <ReservationCard 
                                key={reservation.id} 
                                reservation={reservation} 
                                onClick={() => setSelectedReservation(reservation)} 
                              />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Orders Tab - Only for takeaway and hybrid */}
                  {showOrders && (
                    <TabsContent value="orders" className="mt-0">
                      <div className="grid grid-cols-4 gap-2">
                        {(["pending", "confirmed", "preparing", "ready"] as const).map((status) => (
                          <div key={status} className="space-y-2">
                            <div className="flex items-center gap-1">
                              <span className={`${orderStatusConfig[status].color}`}>
                                {orderStatusConfig[status].icon}
                              </span>
                              <span className={`text-xs font-medium ${orderStatusConfig[status].color}`}>
                                {orderStatusConfig[status].label}
                              </span>
                              <Badge variant="outline" className="ml-auto text-[10px]">
                                {groupedOrders[status].length}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              {groupedOrders[status].map((order) => {
                                const items = getOrderItems(order.items);
                                return (
                                  <div 
                                    key={order.id} 
                                    className={`p-2 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${orderStatusConfig[status].bgColor}`}
                                    onClick={() => setSelectedOrder(order)}
                                  >
                                    <div className="flex items-start justify-between mb-1">
                                      <div>
                                        <p className="font-bold text-sm">#{order.order_number}</p>
                                        <p className="text-[10px] text-muted-foreground">{order.customer_name}</p>
                                      </div>
                                      <p className="font-semibold text-xs">
                                        £{order.total.toFixed(2)}
                                      </p>
                                    </div>
                                    
                                    <div className="text-[9px] mb-1 space-y-0.5">
                                      {items.slice(0, 2).map((item, idx) => (
                                        <p key={idx} className="text-muted-foreground">
                                          {item.quantity}x {item.name}
                                        </p>
                                      ))}
                                      {items.length > 2 && (
                                        <p className="text-muted-foreground italic">
                                          +{items.length - 2} more
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                      <Clock className="w-2.5 h-2.5" />
                                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  {/* Reservations Tab - Only for dinein and hybrid */}
                  {showReservations && (
                    <TabsContent value="reservations" className="mt-0">
                      <div className="grid grid-cols-2 gap-3">
                        {DEMO_RESERVATIONS.map((reservation) => (
                          <ReservationCard 
                            key={reservation.id} 
                            reservation={reservation} 
                            onClick={() => setSelectedReservation(reservation)} 
                          />
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  {/* Calls Tab - Matching real CallsTab */}
                  <TabsContent value="calls" className="mt-0 space-y-3">
                    {/* Analytics Cards */}
                    <div className="grid grid-cols-4 gap-2">
                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Total Calls</CardTitle>
                          <Phone className="w-3 h-3 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">{callStats.totalCalls}</div>
                          <p className="text-[9px] text-muted-foreground">Today</p>
                        </CardContent>
                      </Card>

                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">
                            {selectedType === "dinein" ? "Reservations" : "Orders"}
                          </CardTitle>
                          <CalendarCheck className="w-3 h-3 text-primary" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-primary">{callStats.bookingsCreated}</div>
                          <p className="text-[9px] text-muted-foreground">Today</p>
                        </CardContent>
                      </Card>

                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Enquiries</CardTitle>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">{callStats.enquiries}</div>
                          <p className="text-[9px] text-muted-foreground">Today</p>
                        </CardContent>
                      </Card>

                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Cancellations</CardTitle>
                          <XCircle className="w-3 h-3 text-destructive" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-destructive">{callStats.cancellations}</div>
                          <p className="text-[9px] text-muted-foreground">Today</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Recent Calls List */}
                    <Card className="border-border/50">
                      <CardHeader className="p-2 pb-1">
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          Recent Calls
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 pt-0 space-y-1.5">
                        {calls.slice(0, 3).map((call) => (
                          <div
                            key={call.id}
                            className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                          >
                            <div className="bg-primary/10 p-1.5 rounded-md shrink-0">
                              <Phone className="w-3 h-3 text-primary" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs truncate">{call.caller_name || call.caller_phone}</p>
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5" />
                                {format(new Date(call.created_at), "MMM d, h:mm a")}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge 
                                variant={callTypeBadgeVariants[call.call_type] || "outline"} 
                                className="text-[8px] px-1.5 py-0"
                              >
                                {callTypeLabels[call.call_type] || call.call_type}
                              </Badge>
                              {call.needs_review && (
                                <Badge variant="destructive" className="text-[8px] px-1 py-0">
                                  Review
                                </Badge>
                              )}
                              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Messages Tab */}
                  <TabsContent value="messages" className="mt-0 space-y-2">
                    {messages.slice(0, 4).map((message) => (
                      <Card key={message.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{message.caller_name || message.caller_phone}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{message.content}</p>
                            </div>
                            {message.is_urgent && (
                              <Badge variant="destructive" className="text-[10px]">
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(message.created_at), 'MMM d, HH:mm')}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </div>

          {/* Laptop Base */}
          <div className="h-4 bg-muted border-2 border-t-0 border-border rounded-b-xl mx-8" />
          <div className="h-2 bg-muted/50 border border-t-0 border-border/50 rounded-b-lg mx-16" />
        </div>

        {/* Floating Phone Mockup - Bottom right overlay */}
        <div className="absolute -right-8 md:-right-4 lg:right-0 bottom-8 z-20 scale-[0.6] md:scale-[0.55] lg:scale-[0.65] origin-bottom-right">
          {/* Realistic iPhone-style frame */}
          <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[40px] p-[10px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)_inset]">
            {/* Side buttons - Volume */}
            <div className="absolute -left-[2px] top-24 w-[3px] h-8 bg-zinc-700 rounded-l-sm" />
            <div className="absolute -left-[2px] top-36 w-[3px] h-8 bg-zinc-700 rounded-l-sm" />
            {/* Side button - Power */}
            <div className="absolute -right-[2px] top-28 w-[3px] h-12 bg-zinc-700 rounded-r-sm" />
            
            {/* Inner screen bezel */}
            <div className="bg-black rounded-[32px] overflow-hidden">
              {/* Dynamic Island */}
              <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20 flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
                <div className="w-2 h-2 rounded-full bg-zinc-700" />
              </div>
              
              {/* Screen content */}
              <div className="bg-background rounded-[32px] overflow-hidden w-[280px]">
                {/* Status Bar */}
                <div className="px-6 pt-3 pb-1 flex justify-between items-center text-[11px]">
                  <span className="font-semibold">{currentTime}</span>
                  <div className="w-[90px]" />
                  <div className="flex gap-1.5 items-center">
                    <svg className="w-4 h-3" viewBox="0 0 17 10" fill="currentColor">
                      <rect x="0" y="3" width="3" height="7" rx="0.5" fillOpacity="0.3"/>
                      <rect x="4" y="2" width="3" height="8" rx="0.5" fillOpacity="0.5"/>
                      <rect x="8" y="1" width="3" height="9" rx="0.5" fillOpacity="0.7"/>
                      <rect x="12" y="0" width="3" height="10" rx="0.5"/>
                    </svg>
                    <svg className="w-4 h-3" viewBox="0 0 15 11" fill="currentColor">
                      <path d="M7.5 2.5c2.5 0 4.5 1 6 2.5-.3.4-.6.7-1 1-1.2-1.2-2.9-2-5-2s-3.8.8-5 2c-.4-.3-.7-.6-1-1 1.5-1.5 3.5-2.5 6-2.5z" fillOpacity="0.4"/>
                      <path d="M7.5 5c1.7 0 3.2.7 4.3 1.7-.3.4-.6.7-1 1-.8-.7-1.9-1.2-3.3-1.2s-2.5.5-3.3 1.2c-.4-.3-.7-.6-1-1C4.3 5.7 5.8 5 7.5 5z" fillOpacity="0.7"/>
                      <circle cx="7.5" cy="9" r="1.5"/>
                    </svg>
                    <div className="w-6 h-3 border border-current rounded-[3px] relative">
                      <div className="absolute inset-[2px] right-[4px] bg-current rounded-[1px]" />
                      <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[2px] h-1.5 bg-current rounded-r-sm" />
                    </div>
                  </div>
                </div>
                
                {/* App Content */}
                <div className="p-3 pt-1 space-y-3 min-h-[420px]">
                  {/* App Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div>
                      <div className="text-sm font-bold">{businessConfig.name}</div>
                      <div className="text-[10px] text-muted-foreground">{businessConfig.subtitle}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 h-5 gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Active
                    </Badge>
                  </div>
                  
                  {/* Interactive Tab Bar */}
                  <div className={`flex gap-1 bg-muted rounded-lg p-1`}>
                    <button 
                      onClick={() => setPhoneTab("dashboard")}
                      className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "dashboard" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 mx-auto mb-0.5" />
                      <span>Home</span>
                    </button>
                    {showOrders && (
                      <button 
                        onClick={() => setPhoneTab("orders")}
                        className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "orders" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 mx-auto mb-0.5" />
                        <span>Orders</span>
                      </button>
                    )}
                    {showReservations && (
                      <button 
                        onClick={() => setPhoneTab("tables")}
                        className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "tables" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 mx-auto mb-0.5" />
                        <span>Tables</span>
                      </button>
                    )}
                    <button 
                      onClick={() => setPhoneTab("calls")}
                      className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "calls" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Phone className="w-3.5 h-3.5 mx-auto mb-0.5" />
                      <span>Calls</span>
                    </button>
                    <button 
                      onClick={() => setPhoneTab("messages")}
                      className={`flex-1 rounded-md text-[10px] text-center py-1.5 transition-all ${phoneTab === "messages" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mx-auto mb-0.5" />
                      <span>Msgs</span>
                    </button>
                  </div>
                  
                  {/* Tab Content */}
                  {phoneTab === "dashboard" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Card className="border-border/50 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">
                              {selectedType === "dinein" ? "Reservations" : "Orders"}
                            </span>
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="text-lg font-bold">
                            {selectedType === "dinein" 
                              ? (stats as typeof DEMO_RESERVATION_STATS).reservationsCount 
                              : (stats as typeof DEMO_RESTAURANT_STATS).ordersCount}
                          </div>
                        </Card>
                        <Card className="border-border/50 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">
                              {selectedType === "dinein" ? "Seated" : "Completed"}
                            </span>
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          </div>
                          <div className="text-lg font-bold text-green-600">
                            {selectedType === "dinein" 
                              ? (stats as typeof DEMO_RESERVATION_STATS).reservationsCount - (stats as typeof DEMO_RESERVATION_STATS).cancelledCount
                              : (stats as typeof DEMO_RESTAURANT_STATS).completedCount}
                          </div>
                        </Card>
                        <Card className="border-border/50 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">Cancelled</span>
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          </div>
                          <div className="text-lg font-bold text-destructive">
                            {selectedType === "dinein" 
                              ? (stats as typeof DEMO_RESERVATION_STATS).cancelledCount 
                              : (stats as typeof DEMO_RESTAURANT_STATS).cancelledCount}
                          </div>
                        </Card>
                        <Card className="border-border/50 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">
                              {selectedType === "dinein" ? "Covers" : "Revenue"}
                            </span>
                            {selectedType === "dinein" ? (
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="text-lg font-bold">
                            {selectedType === "dinein" 
                              ? (stats as typeof DEMO_RESERVATION_STATS).totalCovers
                              : `£${(stats as typeof DEMO_RESTAURANT_STATS).revenue.toFixed(0)}`}
                          </div>
                        </Card>
                      </div>
                      
                      {/* Active Section - Orders for takeaway/hybrid */}
                      {showOrders && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">Active Orders</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                              {activeOrders.length} active
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            {activeOrders.slice(0, selectedType === "hybrid" ? 1 : 2).map((order) => (
                              <Card key={order.id} className={`p-2 border ${orderStatusConfig[order.status].bgColor}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={orderStatusConfig[order.status].color}>
                                      {orderStatusConfig[order.status].icon}
                                    </span>
                                    <span className="text-xs font-bold">#{order.order_number}</span>
                                  </div>
                                  <span className="text-xs font-medium">£{order.total.toFixed(2)}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">{order.customer_name}</div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reservations Section - for dinein/hybrid */}
                      {showReservations && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">Today's Tables</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                              {DEMO_RESERVATIONS.length} bookings
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            {DEMO_RESERVATIONS.slice(0, selectedType === "hybrid" ? 1 : 2).map((res, i) => (
                              <Card key={i} className="border-border/50 p-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-medium">{res.customer_name}</div>
                                  <div className="text-[10px]">{format(new Date(res.reservation_time), 'HH:mm')}</div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                  <Users className="w-3 h-3" />
                                  <span>{res.party_size} guests</span>
                                  <span>• Table {res.table.table_number}</span>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {phoneTab === "orders" && showOrders && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold">Order Queue</div>
                      {activeOrders.slice(0, 4).map((order) => (
                        <Card key={order.id} className={`border p-2 ${orderStatusConfig[order.status]?.bgColor || ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">#{order.order_number}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {orderStatusConfig[order.status]?.label}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{order.customer_name}</p>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {phoneTab === "tables" && showReservations && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold">Today's Reservations</div>
                      {DEMO_RESERVATIONS.slice(0, 4).map((res) => (
                        <Card key={res.id} className="border-border/50 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{res.customer_name}</span>
                            <span className="text-[10px] text-muted-foreground">{res.party_size} guests</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Table {res.table.table_number}</p>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {phoneTab === "calls" && (
                    <div className="space-y-2">
                      {calls.slice(0, 4).map((call) => (
                        <Card key={call.id} className="border-border/50 p-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-medium">{call.caller_name}</p>
                              <p className="text-[9px] text-muted-foreground">{call.caller_phone}</p>
                            </div>
                            <Badge 
                              variant={callTypeBadgeVariants[call.call_type] || "outline"} 
                              className="text-[8px] px-1.5 py-0.5"
                            >
                              {callTypeLabels[call.call_type] || call.call_type}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {phoneTab === "messages" && (
                    <div className="space-y-2">
                      {messages.slice(0, 4).map((msg) => (
                        <Card key={msg.id} className={`border-border/50 p-2 ${msg.is_urgent ? 'border-l-2 border-l-destructive' : ''}`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-medium">{msg.caller_name}</span>
                            {msg.is_urgent && (
                              <Badge variant="destructive" className="text-[8px] px-1 py-0">Urgent</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{msg.content}</div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Home Indicator */}
                <div className="flex justify-center pb-2 pt-1">
                  <div className="w-28 h-1 bg-foreground/20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedOrder.customer_name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.customer_phone}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Items</p>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span>£{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>£{selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Type: {selectedOrder.order_type}</p>
                <p>Created: {format(new Date(selectedOrder.created_at), 'MMM d, HH:mm')}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedReservation.customer_name}</p>
                <p className="text-xs text-muted-foreground">{selectedReservation.customer_phone}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Party Size</p>
                  <p className="font-medium">{selectedReservation.party_size} guests</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Table</p>
                  <p className="font-medium">Table {selectedReservation.table.table_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(new Date(selectedReservation.reservation_time), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="secondary" className="mt-0.5">
                    {selectedReservation.status}
                  </Badge>
                </div>
              </div>
              {'special_requests' in selectedReservation && selectedReservation.special_requests && (
                <div>
                  <p className="text-sm text-muted-foreground">Special Requests</p>
                  <p className="text-sm">{String(selectedReservation.special_requests)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoDashboard;
