import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes } from "date-fns";
import { Search, Clock, Phone, ChefHat, CheckCircle, XCircle, RefreshCw, Package } from "lucide-react";
import { OrderReceiptDialog } from "./OrderReceiptDialog";
import { DEMO_ORDERS } from "@/lib/demoData";

interface OrderItem {
  item_id?: string;
  name?: string;
  item_name?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  options?: { name: string; price: number }[];
  selectedOptions?: { option: { name: string }; selectedSize?: { name: string } }[];
  selectedSize?: { name: string };
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: string;
  order_type: string;
  pickup_time: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface OrdersTabProps {
  businessId: string;
  currency?: string;
  averagePrepTime?: number;
  isDemoMode?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "New", color: "bg-blue-500", icon: <Package className="w-4 h-4" /> },
  preparing: { label: "Preparing", color: "bg-yellow-500", icon: <ChefHat className="w-4 h-4" /> },
  ready: { label: "Ready", color: "bg-green-500", icon: <CheckCircle className="w-4 h-4" /> },
  completed: { label: "Completed", color: "bg-muted", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "Cancelled", color: "bg-destructive", icon: <XCircle className="w-4 h-4" /> },
};

export function OrdersTab({ businessId, currency = "GBP", averagePrepTime = 20, isDemoMode = false }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>(isDemoMode ? DEMO_ORDERS as Order[] : []);
  const [loading, setLoading] = useState(!isDemoMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();

  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
    return symbols[currency] || currency;
  };

  const loadOrders = async () => {
    let query = supabase
      .from("orders")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (statusFilter === "active") {
      query = query.in("status", ["pending", "preparing", "ready"]);
    } else if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading orders:", error);
    } else {
      setOrders((data || []).map(order => ({
        ...order,
        items: (order.items as unknown as OrderItem[]) || []
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isDemoMode) return; // Skip data loading in demo mode
    loadOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, statusFilter]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (newStatus === "cancelled") {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Order Updated",
        description: `Order marked as ${newStatus}`,
      });
      setSelectedOrder(null);
      loadOrders();
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  });

  const getNextStatus = (currentStatus: string) => {
    const flow: Record<string, string> = {
      pending: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[currentStatus];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Orders</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">New</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredOrders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.pending;
            const nextStatus = getNextStatus(order.status);

            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedOrder(order)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">
                      {order.order_number}
                    </CardTitle>
                    <Badge className={`${config.color} text-white gap-1`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium">{order.customer_name}</div>
                  {order.customer_phone && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {order.customer_phone}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""} •{" "}
                    {getCurrencySymbol()}{order.total?.toFixed(2)}
                  </div>
                  {/* Show estimated ready time (order time + prep time) */}
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="w-3 h-3" />
                    Ready: {format(addMinutes(new Date(order.created_at), averagePrepTime), "h:mm a")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ordered {format(new Date(order.created_at), "h:mm a")}
                  </div>

                  {nextStatus && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOrderStatus(order.id, nextStatus);
                      }}
                    >
                      Mark as {statusConfig[nextStatus]?.label || nextStatus}
                    </Button>
                  )}
                  <Select
                    value={order.status}
                    onValueChange={(val) => {
                      if (val !== order.status) updateOrderStatus(order.id, val);
                    }}
                  >
                    <SelectTrigger className="w-full h-7 text-xs mt-1" onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Set status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">New</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Receipt Dialog */}
      <OrderReceiptDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        currency={currency}
        averagePrepTime={averagePrepTime}
        onUpdateStatus={(orderId, newStatus) => {
          updateOrderStatus(orderId, newStatus);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
