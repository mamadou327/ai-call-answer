import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  category_id?: string;
}

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  currency?: string;
  onOrderCreated?: () => void;
}

export function ManualOrderDialog({ open, onOpenChange, businessId, currency = "GBP", onOrderCreated }: ManualOrderDialogProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupMinutes, setPickupMinutes] = useState("15");
  const [loading, setLoading] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
    return symbols[currency] || currency;
  };

  useEffect(() => {
    if (open) {
      loadMenuItems();
      // Reset form
      setOrderItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setPickupMinutes("15");
    }
  }, [open, businessId]);

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, price, description, category_id")
      .eq("business_id", businessId)
      .eq("is_available", true)
      .order("name");

    if (!error && data) {
      setMenuItems(data);
    }
    setLoadingMenu(false);
  };

  const addItem = (item: MenuItem) => {
    const existingIndex = orderItems.findIndex(oi => oi.item_id === item.id);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        item_id: item.id,
        name: item.name,
        quantity: 1,
        price: item.price
      }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev => {
      const updated = prev.map(item => {
        if (item.item_id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
      return updated;
    });
  };

  const removeItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.item_id !== itemId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const generateOrderNumber = () => {
    // Generate random 4-digit code
    return `#${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter customer name");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setLoading(true);

    const pickupTime = new Date();
    pickupTime.setMinutes(pickupTime.getMinutes() + parseInt(pickupMinutes));

    const orderNumber = generateOrderNumber();
    const total = calculateTotal();

    const { error } = await supabase
      .from("orders")
      .insert([{
        business_id: businessId,
        order_number: orderNumber,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        items: orderItems as unknown as any,
        subtotal: total,
        total: total,
        order_type: "pickup",
        pickup_time: pickupTime.toISOString(),
        notes: notes.trim() || null,
        status: "confirmed"
      }]);

    if (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
    } else {
      toast.success(`Order ${orderNumber} created!`);
      onOrderCreated?.();
      onOpenChange(false);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone (optional)</Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
          </div>

          {/* Pickup Time */}
          <div className="space-y-2">
            <Label>Pickup Time</Label>
            <Select value={pickupMinutes} onValueChange={setPickupMinutes}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Menu Items */}
          <div className="space-y-2">
            <Label>Add Items</Label>
            {loadingMenu ? (
              <p className="text-sm text-muted-foreground">Loading menu...</p>
            ) : menuItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No menu items available</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/20">
                {menuItems.map((item) => (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => addItem(item)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {item.name} ({getCurrencySymbol()}{item.price.toFixed(2)})
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <Label>Order Items</Label>
              <div className="border rounded-md divide-y">
                {orderItems.map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between p-3">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {getCurrencySymbol()}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.item_id, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.item_id, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(item.item_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between p-3 font-semibold bg-muted/50">
                  <span>Total</span>
                  <span>{getCurrencySymbol()}{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || orderItems.length === 0}>
            {loading ? "Creating..." : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}