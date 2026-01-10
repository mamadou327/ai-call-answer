import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChefHat, Package, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  order_type: string;
  pickup_time: string | null;
  total: number | null;
  items: any;
  notes: string | null;
  created_at: string;
}

interface RestaurantOrderQueueProps {
  orders: Order[];
  currency?: string;
  onOrderUpdate: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
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

const getCurrencySymbol = (curr: string) => {
  const symbols: Record<string, string> = {
    GBP: "£", USD: "$", EUR: "€", CAD: "$", AUD: "$", JPY: "¥", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
  };
  return symbols[curr] || "$";
};

export const RestaurantOrderQueue = ({ orders, currency = "GBP", onOrderUpdate }: RestaurantOrderQueueProps) => {
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol(currency);

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[currentStatus] || null;
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    }
    if (newStatus === "cancelled") {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Order updated",
        description: `Order marked as ${newStatus}`,
      });
      onOrderUpdate();
    }
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

  // Group orders by status (no pending - orders start as confirmed)
  const groupedOrders = {
    confirmed: orders.filter(o => o.status === "confirmed"),
    preparing: orders.filter(o => o.status === "preparing"),
    ready: orders.filter(o => o.status === "ready"),
  };

  const totalActiveOrders = orders.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Active Orders</CardTitle>
          <Badge variant="secondary" className="text-sm">
            {totalActiveOrders} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {totalActiveOrders === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No active orders</p>
            <p className="text-sm">New orders will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["confirmed", "preparing", "ready"] as const).map((status) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`${statusConfig[status].color}`}>
                    {statusConfig[status].icon}
                  </span>
                  <h3 className={`font-medium ${statusConfig[status].color}`}>
                    {statusConfig[status].label}
                  </h3>
                  <Badge variant="outline" className="ml-auto">
                    {groupedOrders[status].length}
                  </Badge>
                </div>
                
                <div className="space-y-2 min-h-[100px]">
                  {groupedOrders[status].map((order) => {
                    const items = getOrderItems(order.items);
                    const nextStatus = getNextStatus(order.status);
                    
                    return (
                      <div 
                        key={order.id} 
                        className={`p-3 rounded-lg border ${statusConfig[status].bgColor}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-lg">#{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          </div>
                          <p className="font-semibold text-sm">
                            {currencySymbol}{(order.total || 0).toFixed(2)}
                          </p>
                        </div>
                        
                        {/* Order Items */}
                        <div className="text-xs mb-2 space-y-0.5">
                          {items.slice(0, 3).map((item, idx) => (
                            <p key={idx} className="text-muted-foreground">
                              {item.quantity}x {item.name}
                            </p>
                          ))}
                          {items.length > 3 && (
                            <p className="text-muted-foreground italic">
                              +{items.length - 3} more items
                            </p>
                          )}
                        </div>

                        {/* Time info */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </div>

                        {order.pickup_time && (
                          <div className="text-xs text-muted-foreground mb-2">
                            Pickup: {format(new Date(order.pickup_time), "HH:mm")}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {nextStatus && (
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => updateOrderStatus(order.id, nextStatus)}
                            >
                              {nextStatus === "completed" ? "Complete" : `Mark ${statusConfig[nextStatus]?.label || nextStatus}`}
                            </Button>
                          )}
                          {order.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => updateOrderStatus(order.id, "cancelled")}
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
