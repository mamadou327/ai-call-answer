import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMinutes } from "date-fns";
import { Clock, Phone, MapPin, User, Package, ChefHat, CheckCircle, XCircle, Receipt } from "lucide-react";

interface OrderItem {
  item_id?: string;
  name?: string;
  item_name?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  notes?: string;
  options?: { name: string; price: number }[];
  selectedOptions?: { option: { name: string }; selectedSize?: { name: string } }[];
  selectedSize?: { name: string };
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email?: string | null;
  items: OrderItem[];
  subtotal?: number;
  total: number | null;
  status: string;
  order_type: string;
  pickup_time: string | null;
  notes: string | null;
  created_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  delivery_address?: string | null;
}

interface OrderReceiptDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  averagePrepTime?: number;
  onUpdateStatus?: (orderId: string, newStatus: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "New", color: "bg-blue-500", icon: <Package className="w-4 h-4" /> },
  confirmed: { label: "Confirmed", color: "bg-blue-600", icon: <CheckCircle className="w-4 h-4" /> },
  preparing: { label: "Preparing", color: "bg-yellow-500", icon: <ChefHat className="w-4 h-4" /> },
  ready: { label: "Ready", color: "bg-green-500", icon: <CheckCircle className="w-4 h-4" /> },
  completed: { label: "Completed", color: "bg-muted", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "Cancelled", color: "bg-destructive", icon: <XCircle className="w-4 h-4" /> },
};

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", CAD: "$", AUD: "$" };
  return symbols[currency] || currency;
};

const getNextStatus = (currentStatus: string) => {
  const flow: Record<string, string> = {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "completed",
  };
  return flow[currentStatus];
};

export const OrderReceiptDialog = ({
  order,
  open,
  onOpenChange,
  currency = "GBP",
  averagePrepTime = 20,
  onUpdateStatus,
}: OrderReceiptDialogProps) => {
  if (!order) return null;

  const symbol = getCurrencySymbol(currency);
  const config = statusConfig[order.status] || statusConfig.pending;
  const nextStatus = getNextStatus(order.status);

  // Calculate pickup time: order created_at + average prep time
  const orderTime = new Date(order.created_at);
  const estimatedPickupTime = addMinutes(orderTime, averagePrepTime);

  const parseItemDetails = (item: OrderItem) => {
    const itemName = item.name || item.item_name || "Unknown Item";
    const itemPrice = item.price ?? item.unit_price ?? 0;
    
    // Parse notes field which contains "Size: X | Options: Y, Z | special instructions"
    let sizeDisplay = "";
    let optionsDisplay: string[] = [];
    let specialInstructions = "";

    if (item.notes) {
      const parts = item.notes.split(" | ");
      parts.forEach(part => {
        if (part.startsWith("Size: ")) {
          sizeDisplay = part.replace("Size: ", "");
        } else if (part.startsWith("Options: ")) {
          optionsDisplay = part.replace("Options: ", "").split(", ");
        } else if (!part.startsWith("Size:") && !part.startsWith("Options:")) {
          specialInstructions = part;
        }
      });
    }

    // Fallback to old structure if available
    if (!sizeDisplay && item.selectedSize?.name) {
      sizeDisplay = item.selectedSize.name;
    }
    
    if (optionsDisplay.length === 0) {
      if (item.options?.length) {
        optionsDisplay = item.options.map(o => o.name);
      } else if (item.selectedOptions?.length) {
        optionsDisplay = item.selectedOptions.map(o => 
          o.selectedSize ? `${o.option.name} (${o.selectedSize.name})` : o.option.name
        );
      }
    }

    return { itemName, itemPrice, sizeDisplay, optionsDisplay, specialInstructions };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Order Receipt
            </DialogTitle>
            <Badge className={`${config.color} text-white gap-1`}>
              {config.icon}
              {config.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Number & Time */}
          <div className="text-center border-b pb-4">
            <p className="text-2xl font-mono font-bold">{order.order_number}</p>
            <p className="text-sm text-muted-foreground">
              {format(orderTime, "MMM d, yyyy 'at' h:mm a")}
            </p>
            <Badge variant="outline" className="mt-2 capitalize">
              {order.order_type}
            </Badge>
          </div>

          {/* Customer Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{order.customer_phone}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{order.delivery_address}</span>
              </div>
            )}
          </div>

          {/* Pickup/Ready Time */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  {order.order_type === "delivery" ? "Estimated Delivery" : "Estimated Ready Time"}
                </p>
                <p className="text-lg font-bold">
                  {format(estimatedPickupTime, "h:mm a")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ordered at {format(orderTime, "h:mm a")} + {averagePrepTime} min prep
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Items - Receipt Style */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Items Ordered</h4>
            <Table>
              <TableBody>
                {order.items.map((item, idx) => {
                  const { itemName, itemPrice, sizeDisplay, optionsDisplay, specialInstructions } = parseItemDetails(item);
                  const lineTotal = itemPrice * item.quantity;
                  
                  return (
                    <TableRow key={idx} className="border-0">
                      <TableCell className="py-2 pl-0 align-top">
                        <div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[24px]">{item.quantity}x</span>
                            <div className="flex-1">
                              <p className="font-medium">{itemName}</p>
                              {sizeDisplay && (
                                <p className="text-xs text-muted-foreground">
                                  Size: {sizeDisplay}
                                </p>
                              )}
                              {optionsDisplay.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {optionsDisplay.map((opt, i) => (
                                    <p key={i}>+ {opt}</p>
                                  ))}
                                </div>
                              )}
                              {specialInstructions && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  Note: {specialInstructions}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 pr-0 text-right align-top font-medium">
                        {symbol}{lineTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                {order.subtotal && order.subtotal !== order.total && (
                  <TableRow>
                    <TableCell className="pl-0">Subtotal</TableCell>
                    <TableCell className="text-right pr-0">{symbol}{order.subtotal.toFixed(2)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="pl-0 font-bold text-base">Total</TableCell>
                  <TableCell className="text-right pr-0 font-bold text-base">
                    {symbol}{(order.total || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Order Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">Order Notes</p>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          {onUpdateStatus && (
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                {nextStatus && (
                  <Button
                    className="flex-1"
                    onClick={() => onUpdateStatus(order.id, nextStatus)}
                  >
                    Mark as {statusConfig[nextStatus]?.label || nextStatus}
                  </Button>
                )}
                {order.status !== "cancelled" && order.status !== "completed" && (
                  <Button
                    variant="destructive"
                    onClick={() => onUpdateStatus(order.id, "cancelled")}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>
              <Select
                value={order.status}
                onValueChange={(val) => {
                  if (val !== order.status) onUpdateStatus(order.id, val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Set status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">New</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
