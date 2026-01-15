import { useState } from "react";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  CalendarDays, 
  Phone, 
  MessageSquare,
  TrendingUp,
  Users,
  Clock,
  ChefHat,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  DEMO_ORDERS, 
  DEMO_RESERVATIONS, 
  DEMO_RESTAURANT_CALLS, 
  DEMO_RESTAURANT_MESSAGES,
  DEMO_RESTAURANT_STATS 
} from "@/lib/demoData";
import { format } from "date-fns";

type DemoOrder = typeof DEMO_ORDERS[0];
type DemoReservation = typeof DEMO_RESERVATIONS[0];

const OrderCard = ({ order, onClick }: { order: DemoOrder; onClick: () => void }) => {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    confirmed: { label: "Confirmed", variant: "secondary" },
    preparing: { label: "Preparing", variant: "default" },
    ready: { label: "Ready", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const status = statusConfig[order.status] || statusConfig.pending;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-sm">#{order.order_number}</p>
            <p className="text-xs text-muted-foreground">{order.customer_name}</p>
          </div>
          <Badge variant={status.variant} className="text-[10px] px-1.5 py-0.5">
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
          <span className="font-medium text-foreground">£{order.total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<DemoReservation | null>(null);

  const stats = DEMO_RESTAURANT_STATS;

  return (
    <div className="relative mt-16">
      {/* Floating hint badge */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
        <Badge 
          variant="secondary" 
          className="bg-primary text-primary-foreground px-4 py-1.5 text-sm shadow-lg animate-pulse"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Try it! Click around to explore
        </Badge>
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
                  <h2 className="text-lg font-bold">The Golden Fork</h2>
                  <p className="text-xs text-muted-foreground">Hybrid Restaurant Demo</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                  AIVIA Active
                </Badge>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5 h-9">
                  <TabsTrigger value="dashboard" className="text-xs gap-1">
                    <LayoutDashboard className="w-3 h-3" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs gap-1">
                    <ShoppingBag className="w-3 h-3" />
                    <span className="hidden sm:inline">Orders</span>
                  </TabsTrigger>
                  <TabsTrigger value="reservations" className="text-xs gap-1">
                    <CalendarDays className="w-3 h-3" />
                    <span className="hidden sm:inline">Tables</span>
                  </TabsTrigger>
                  <TabsTrigger value="calls" className="text-xs gap-1">
                    <Phone className="w-3 h-3" />
                    <span className="hidden sm:inline">Calls</span>
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="text-xs gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="hidden sm:inline">Messages</span>
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[280px] mt-4">
                  {/* Dashboard Tab */}
                  <TabsContent value="dashboard" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10">
                              <ShoppingBag className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-xl font-bold">{stats.ordersCount}</p>
                              <p className="text-[10px] text-muted-foreground">Orders Today</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-green-500/10">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                              <p className="text-xl font-bold">£{stats.revenue}</p>
                              <p className="text-[10px] text-muted-foreground">Revenue</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-blue-500/10">
                              <Users className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xl font-bold">{DEMO_RESERVATIONS.length}</p>
                              <p className="text-[10px] text-muted-foreground">Reservations</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-orange-500/10">
                              <Phone className="w-4 h-4 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-xl font-bold">{stats.callsCount}</p>
                              <p className="text-[10px] text-muted-foreground">Calls Handled</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-border/50">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ChefHat className="w-4 h-4" />
                          Active Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="grid grid-cols-2 gap-2">
                          {DEMO_ORDERS.slice(0, 2).map((order) => (
                            <OrderCard 
                              key={order.id} 
                              order={order} 
                              onClick={() => setSelectedOrder(order)} 
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Orders Tab */}
                  <TabsContent value="orders" className="mt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {DEMO_ORDERS.map((order) => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onClick={() => setSelectedOrder(order)} 
                        />
                      ))}
                    </div>
                  </TabsContent>

                  {/* Reservations Tab */}
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

                  {/* Calls Tab */}
                  <TabsContent value="calls" className="mt-0 space-y-2">
                    {DEMO_RESTAURANT_CALLS.slice(0, 4).map((call) => (
                      <Card key={call.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{call.caller_name || call.caller_phone}</p>
                              <p className="text-xs text-muted-foreground">{call.summary}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {call.call_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{Math.floor(call.duration_ms / 1000)}s</span>
                            <span className="ml-auto">{format(new Date(call.created_at), 'HH:mm')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* Messages Tab */}
                  <TabsContent value="messages" className="mt-0 space-y-2">
                    {DEMO_RESTAURANT_MESSAGES.slice(0, 4).map((message) => (
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
                    {format(new Date(selectedReservation.reservation_time), 'MMM d, HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedReservation.duration_minutes} min</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoDashboard;
