import { useState } from "react";
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
  Calendar
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
  DEMO_RESERVATION_STATS
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
type RestaurantType = "takeaway" | "dinein" | "hybrid";

interface BusinessConfig {
  name: string;
  subtitle: string;
}

const businessConfigs: Record<RestaurantType, BusinessConfig> = {
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
  const [selectedType, setSelectedType] = useState<RestaurantType>("hybrid");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<DemoReservation | null>(null);
  const [dateRange, setDateRange] = useState("today");

  // Get config based on selected type
  const businessConfig = businessConfigs[selectedType];
  
  // Get stats based on type
  const stats = selectedType === "dinein" ? DEMO_RESERVATION_STATS : DEMO_RESTAURANT_STATS;
  
  // Get calls and messages based on type
  const calls = selectedType === "dinein" ? DEMO_DINEIN_CALLS : DEMO_RESTAURANT_CALLS;
  const messages = selectedType === "dinein" ? DEMO_DINEIN_MESSAGES : DEMO_RESTAURANT_MESSAGES;
  
  // Calculate call stats dynamically based on actual call data
  const callStats = {
    totalCalls: calls.length,
    bookingsCreated: calls.filter(c => 
      c.call_type === "new_order" || c.call_type === "new_reservation" || c.call_type === "new_booking"
    ).length,
    enquiries: calls.filter(c => c.call_type === "question").length,
    cancellations: calls.filter(c => c.call_type === "cancel").length,
  };
  
  // Show orders for takeaway and hybrid
  const showOrders = selectedType === "takeaway" || selectedType === "hybrid";
  // Show reservations for dinein and hybrid
  const showReservations = selectedType === "dinein" || selectedType === "hybrid";
  
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

  // Get correct tab count based on type
  const getTabCount = () => {
    if (selectedType === "hybrid") return 5;
    return 4;
  };

  // Reset to dashboard tab when switching types
  const handleTypeChange = (type: RestaurantType) => {
    setSelectedType(type);
    setActiveTab("dashboard");
  };

  return (
    <div className="relative mt-16">
      {/* Restaurant Type Selector */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-full p-1 shadow-lg">
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
        </div>
      </div>

      {/* Laptop Frame */}
      <div className="max-w-4xl mx-auto">
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
                          <SelectTrigger className="w-[100px] h-7 text-xs">
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
                          <CardTitle className="text-[10px] font-medium">
                            {selectedType === "dinein" ? "Reservations" : "Total Orders"}
                          </CardTitle>
                          <Package className="w-3 h-3 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">
                            {selectedType === "dinein" ? (stats as typeof DEMO_RESERVATION_STATS).reservationsCount : (stats as typeof DEMO_RESTAURANT_STATS).ordersCount}
                          </div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">
                            {selectedType === "dinein" ? "No Shows" : "Completed"}
                          </CardTitle>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-green-600">
                            {selectedType === "dinein" ? (stats as typeof DEMO_RESERVATION_STATS).noShowCount : (stats as typeof DEMO_RESTAURANT_STATS).completedCount}
                          </div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Cancelled</CardTitle>
                          <XCircle className="w-3 h-3 text-destructive" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-destructive">
                            {selectedType === "dinein" ? (stats as typeof DEMO_RESERVATION_STATS).cancelledCount : (stats as typeof DEMO_RESTAURANT_STATS).cancelledCount}
                          </div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">
                            {selectedType === "dinein" ? "Total Covers" : "Revenue"}
                          </CardTitle>
                          {selectedType === "dinein" ? (
                            <Users className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                          )}
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">
                            {selectedType === "dinein" 
                              ? (stats as typeof DEMO_RESERVATION_STATS).totalCovers 
                              : `£${(stats as typeof DEMO_RESTAURANT_STATS).revenue.toFixed(2)}`}
                          </div>
                          <p className="text-[9px] text-muted-foreground">{getPeriodLabel()}</p>
                        </CardContent>
                      </Card>
                    </div>

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
                          <p className="text-[9px] text-muted-foreground">This Month</p>
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
                          <p className="text-[9px] text-muted-foreground">This Month</p>
                        </CardContent>
                      </Card>

                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Enquiries</CardTitle>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold">{callStats.enquiries}</div>
                          <p className="text-[9px] text-muted-foreground">This Month</p>
                        </CardContent>
                      </Card>

                      <Card className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 p-2">
                          <CardTitle className="text-[10px] font-medium">Cancellations</CardTitle>
                          <XCircle className="w-3 h-3 text-destructive" />
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                          <div className="text-lg font-bold text-destructive">{callStats.cancellations}</div>
                          <p className="text-[9px] text-muted-foreground">This Month</p>
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
