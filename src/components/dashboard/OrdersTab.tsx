import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Clock, Phone, ChefHat, CheckCircle, XCircle, RefreshCw, Package } from "lucide-react";

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
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "New", color: "bg-blue-500", icon: <Package className="w-4 h-4" /> },
  preparing: { label: "Preparing", color: "bg-yellow-500", icon: <ChefHat className="w-4 h-4" /> },
  ready: { label: "Ready", color: "bg-green-500", icon: <CheckCircle className="w-4 h-4" /> },
  completed: { label: "Completed", color: "bg-muted", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "Cancelled", color: "bg-destructive", icon: <XCircle className="w-4 h-4" /> },
};

export function OrdersTab({ businessId, currency = "GBP" }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  {order.pickup_time && (
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3" />
                      Pickup: {format(new Date(order.pickup_time), "h:mm a")}
                    </div>
                  )}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${statusConfig[selectedOrder.status]?.color} text-white`}>
                  {statusConfig[selectedOrder.status]?.label}
                </Badge>
              </div>

              <div>
                <div className="font-medium">{selectedOrder.customer_name}</div>
                {selectedOrder.customer_phone && (
                  <div className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</div>
                )}
              </div>

              {selectedOrder.pickup_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Pickup: {format(new Date(selectedOrder.pickup_time), "h:mm a")}</span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">Items</div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => {
                    const itemName = item.name || item.item_name || "Unknown Item";
                    const itemPrice = item.price ?? item.unit_price ?? 0;
                    const optionsDisplay = item.options?.length 
                      ? item.options.map(o => o.name).join(", ")
                      : item.selectedOptions?.length
                        ? item.selectedOptions.map(o => 
                            o.selectedSize 
                              ? `${o.option.name} (${o.selectedSize.name})`
                              : o.option.name
                          ).join(", ")
                        : null;
                    const sizeDisplay = item.selectedSize?.name;
                    
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {itemName}
                          {sizeDisplay && (
                            <span className="text-muted-foreground ml-1">({sizeDisplay})</span>
                          )}
                          {optionsDisplay && (
                            <span className="text-muted-foreground ml-1">
                              + {optionsDisplay}
                            </span>
                          )}
                        </span>
                        <span>{getCurrencySymbol()}{(itemPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between font-medium mt-3 pt-3 border-t">
                  <span>Total</span>
                  <span>{getCurrencySymbol()}{selectedOrder.total?.toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <span className="font-medium">Notes: </span>
                  {selectedOrder.notes}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {getNextStatus(selectedOrder.status) && (
                  <Button
                    className="flex-1"
                    onClick={() => updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!)}
                  >
                    Mark as {statusConfig[getNextStatus(selectedOrder.status)!]?.label}
                  </Button>
                )}
                {selectedOrder.status !== "cancelled" && selectedOrder.status !== "completed" && (
                  <Button
                    variant="destructive"
                    onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
