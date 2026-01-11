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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface MenuItemSize {
  id: string;
  name: string;
  price: number;
  is_default?: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  category_id?: string;
  has_sizes?: boolean;
  sizes?: MenuItemSize[];
}

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  size_id?: string;
  size_name?: string;
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
  
  // Size selection state
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>("");

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
    
    // Fetch menu items with has_sizes flag
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("id, name, price, description, category_id, has_sizes")
      .eq("business_id", businessId)
      .eq("is_available", true)
      .order("name");

    if (error || !items) {
      setLoadingMenu(false);
      return;
    }

    // Fetch sizes for items that have them
    const itemsWithSizes = items.filter(item => item.has_sizes);
    if (itemsWithSizes.length > 0) {
      const { data: sizes } = await supabase
        .from("menu_item_sizes")
        .select("id, menu_item_id, name, price, is_default")
        .in("menu_item_id", itemsWithSizes.map(i => i.id))
        .eq("is_available", true)
        .order("display_order");

      // Map sizes to their items
      const itemsWithSizeData = items.map(item => {
        if (item.has_sizes && sizes) {
          const itemSizes = sizes.filter(s => s.menu_item_id === item.id);
          return { ...item, sizes: itemSizes };
        }
        return item;
      });
      
      setMenuItems(itemsWithSizeData);
    } else {
      setMenuItems(items);
    }
    
    setLoadingMenu(false);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.has_sizes && item.sizes && item.sizes.length > 0) {
      // Show size selection dialog
      setSelectedItem(item);
      const defaultSize = item.sizes.find(s => s.is_default) || item.sizes[0];
      setSelectedSizeId(defaultSize.id);
      setSizeDialogOpen(true);
    } else {
      // Add directly without size
      addItem(item);
    }
  };

  const handleSizeConfirm = () => {
    if (!selectedItem || !selectedSizeId) return;
    
    const size = selectedItem.sizes?.find(s => s.id === selectedSizeId);
    if (!size) return;

    addItemWithSize(selectedItem, size);
    setSizeDialogOpen(false);
    setSelectedItem(null);
    setSelectedSizeId("");
  };

  const addItem = (item: MenuItem) => {
    const existingIndex = orderItems.findIndex(oi => oi.item_id === item.id && !oi.size_id);
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

  const addItemWithSize = (item: MenuItem, size: MenuItemSize) => {
    const displayName = `${item.name} (${size.name})`;
    const existingIndex = orderItems.findIndex(oi => oi.item_id === item.id && oi.size_id === size.id);
    
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        item_id: item.id,
        name: displayName,
        quantity: 1,
        price: size.price,
        size_id: size.id,
        size_name: size.name
      }]);
    }
  };

  const getUniqueItemKey = (item: OrderItem) => {
    return item.size_id ? `${item.item_id}-${item.size_id}` : item.item_id;
  };

  const updateQuantity = (item: OrderItem, delta: number) => {
    const key = getUniqueItemKey(item);
    setOrderItems(prev => {
      const updated = prev.map(oi => {
        const oiKey = getUniqueItemKey(oi);
        if (oiKey === key) {
          const newQty = oi.quantity + delta;
          return newQty > 0 ? { ...oi, quantity: newQty } : oi;
        }
        return oi;
      }).filter(oi => oi.quantity > 0);
      return updated;
    });
  };

  const removeItem = (item: OrderItem) => {
    const key = getUniqueItemKey(item);
    setOrderItems(prev => prev.filter(oi => getUniqueItemKey(oi) !== key));
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
    <>
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
                      onClick={() => handleItemClick(item)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {item.name} 
                      {item.has_sizes && item.sizes && item.sizes.length > 0 
                        ? ` (from ${getCurrencySymbol()}${Math.min(...item.sizes.map(s => s.price)).toFixed(2)})`
                        : ` (${getCurrencySymbol()}${item.price.toFixed(2)})`
                      }
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
                  {orderItems.map((item, index) => (
                    <div key={`${getUniqueItemKey(item)}-${index}`} className="flex items-center justify-between p-3">
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
                          onClick={() => updateQuantity(item, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(item)}
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

      {/* Size Selection Dialog */}
      <Dialog open={sizeDialogOpen} onOpenChange={setSizeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Size</DialogTitle>
          </DialogHeader>
          {selectedItem && selectedItem.sizes && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">{selectedItem.name}</p>
              <RadioGroup value={selectedSizeId} onValueChange={setSelectedSizeId}>
                {selectedItem.sizes.map((size) => (
                  <div key={size.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={size.id} id={size.id} />
                      <Label htmlFor={size.id} className="cursor-pointer">{size.name}</Label>
                    </div>
                    <span className="font-medium">{getCurrencySymbol()}{size.price.toFixed(2)}</span>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSizeConfirm}>
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
