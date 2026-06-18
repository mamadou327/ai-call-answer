import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ChefHat, Package, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, addMinutes } from "date-fns";
import { OrderReceiptDialog } from "./OrderReceiptDialog";

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
  businessId: string;
  onOrderUpdate: () => void;
  averagePrepTime?: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
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

const getCurrencySymbol = (curr: string) => {
  const symbols: Record<string, string> = {
    GBP: "£", USD: "$", EUR: "€", CAD: "$", AUD: "$", JPY: "¥", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
  };
  return symbols[curr] || "$";
};

export const RestaurantOrderQueue = ({ orders, currency = "GBP", businessId, onOrderUpdate, averagePrepTime = 20 }: RestaurantOrderQueueProps) => {
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol(currency);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      pending: "confirmed",
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[currentStatus] || null;
  };

  const sendOrderSms = async (orderId: string, type: "confirmation" | "ready" | "cancelled") => {
    try {
      const response = await supabase.functions.invoke("send-order-sms", {
        body: { businessId, orderId, type },
      });
      
      if (response.error) {
        console.warn("SMS send failed:", response.error);
      } else if (response.data?.success) {
        console.log(`SMS (${type}) sent for order:`, orderId);
      }
    } catch (error) {
      console.warn("Error sending SMS:", error);
    }
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
      // Send SMS notifications for ready and cancelled statuses
      if (newStatus === "ready") {
        sendOrderSms(orderId, "ready");
        toast({
          title: "Order ready",
          description: "Customer will receive an SMS notification",
        });
      } else if (newStatus === "cancelled") {
        sendOrderSms(orderId, "cancelled");
        toast({
          title: "Order cancelled",
          description: "Customer has been notified via SMS",
        });
      } else {
        toast({
          title: "Order updated",
          description: `Order marked as ${newStatus}`,
        });
      }
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

  // Group orders by status
  const groupedOrders = {
    pending: orders.filter(o => o.status === "pending"),
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(["pending", "confirmed", "preparing", "ready"] as const).map((status) => (
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
                        className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${statusConfig[status].bgColor}`}
                        onClick={() => setSelectedOrder(order)}
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

                        {/* Time info - Show estimated ready time */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs font-medium mb-2">
                          Ready: {format(addMinutes(new Date(order.created_at), averagePrepTime), "h:mm a")}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

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
    </Card>
  );
};
