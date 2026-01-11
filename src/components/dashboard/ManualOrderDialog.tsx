import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OptionSize {
  id: string;
  name: string;
  price: number;
  is_default?: boolean;
}

interface MenuOption {
  id: string;
  name: string;
  price_adjustment: number;
  has_sizes?: boolean;
  sizes?: OptionSize[];
}

interface OptionGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_selections?: number;
  max_selections?: number;
  options: MenuOption[];
}

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
  option_groups?: OptionGroup[];
}

interface SelectedOption {
  option: MenuOption;
  selectedSize?: OptionSize;
}

interface OrderItemOption {
  name: string;
  size?: string;
  price: number;
}

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  size_id?: string;
  size_name?: string;
  options?: OrderItemOption[];
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
  
  // Customization dialog state
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<Map<string, SelectedOption>>(new Map());

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
    let sizesData: any[] = [];
    if (itemsWithSizes.length > 0) {
      const { data: sizes } = await supabase
        .from("menu_item_sizes")
        .select("id, menu_item_id, name, price, is_default")
        .in("menu_item_id", itemsWithSizes.map(i => i.id))
        .eq("is_available", true)
        .order("display_order");
      sizesData = sizes || [];
    }

    // Fetch option groups for all items
    const { data: optionGroups } = await supabase
      .from("menu_item_option_groups")
      .select("id, menu_item_id, name, is_required, min_selections, max_selections")
      .in("menu_item_id", items.map(i => i.id))
      .order("display_order");

    // Fetch options for all groups
    let optionsData: any[] = [];
    if (optionGroups && optionGroups.length > 0) {
      const { data: options } = await supabase
        .from("menu_item_options")
        .select("id, option_group_id, name, price_adjustment, has_sizes, is_available")
        .in("option_group_id", optionGroups.map(g => g.id))
        .eq("is_available", true)
        .order("display_order");
      optionsData = options || [];
    }

    // Fetch option sizes
    let optionSizesData: any[] = [];
    const optionsWithSizes = optionsData.filter(o => o.has_sizes);
    if (optionsWithSizes.length > 0) {
      const { data: optionSizes } = await supabase
        .from("menu_item_option_sizes")
        .select("id, option_id, name, price, is_default, is_available")
        .in("option_id", optionsWithSizes.map(o => o.id))
        .eq("is_available", true)
        .order("display_order");
      optionSizesData = optionSizes || [];
    }

    // Map everything together
    const enrichedItems = items.map(item => {
      const itemSizes = sizesData.filter(s => s.menu_item_id === item.id);
      const itemOptionGroups = (optionGroups || [])
        .filter(g => g.menu_item_id === item.id)
        .map(group => {
          const groupOptions = optionsData
            .filter(o => o.option_group_id === group.id)
            .map(option => {
              const optionSizes = optionSizesData.filter(s => s.option_id === option.id);
              return {
                ...option,
                sizes: optionSizes.length > 0 ? optionSizes : undefined
              };
            });
          return {
            ...group,
            options: groupOptions
          };
        });

      return {
        ...item,
        sizes: itemSizes.length > 0 ? itemSizes : undefined,
        option_groups: itemOptionGroups.length > 0 ? itemOptionGroups : undefined
      };
    });

    setMenuItems(enrichedItems);
    setLoadingMenu(false);
  };

  const handleItemClick = (item: MenuItem) => {
    const hasSizes = item.has_sizes && item.sizes && item.sizes.length > 0;
    const hasOptions = item.option_groups && item.option_groups.length > 0;

    if (hasSizes || hasOptions) {
      // Show customization dialog
      setSelectedItem(item);
      if (hasSizes && item.sizes) {
        const defaultSize = item.sizes.find(s => s.is_default) || item.sizes[0];
        setSelectedSizeId(defaultSize.id);
      } else {
        setSelectedSizeId("");
      }
      setSelectedOptions(new Map());
      setCustomizeDialogOpen(true);
    } else {
      // Add directly without customization
      addItem(item);
    }
  };

  const toggleOption = (option: MenuOption) => {
    setSelectedOptions(prev => {
      const newMap = new Map(prev);
      if (newMap.has(option.id)) {
        newMap.delete(option.id);
      } else {
        // If option has sizes, set default size
        if (option.has_sizes && option.sizes && option.sizes.length > 0) {
          const defaultSize = option.sizes.find(s => s.is_default) || option.sizes[0];
          newMap.set(option.id, { option, selectedSize: defaultSize });
        } else {
          newMap.set(option.id, { option });
        }
      }
      return newMap;
    });
  };

  const setOptionSize = (optionId: string, size: OptionSize) => {
    setSelectedOptions(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(optionId);
      if (existing) {
        newMap.set(optionId, { ...existing, selectedSize: size });
      }
      return newMap;
    });
  };

  const calculateItemPrice = () => {
    if (!selectedItem) return 0;

    let basePrice = selectedItem.price;
    
    // If item has sizes, use selected size price
    if (selectedItem.has_sizes && selectedItem.sizes && selectedSizeId) {
      const size = selectedItem.sizes.find(s => s.id === selectedSizeId);
      if (size) {
        basePrice = size.price;
      }
    }

    // Add option prices
    selectedOptions.forEach(({ option, selectedSize }) => {
      if (selectedSize) {
        basePrice += selectedSize.price;
      } else {
        basePrice += option.price_adjustment;
      }
    });

    return basePrice;
  };

  const handleCustomizeConfirm = () => {
    if (!selectedItem) return;

    // Validate required options
    if (selectedItem.option_groups) {
      for (const group of selectedItem.option_groups) {
        if (group.is_required) {
          const selectedInGroup = Array.from(selectedOptions.values()).filter(so => 
            group.options.some(o => o.id === so.option.id)
          );
          if (selectedInGroup.length === 0) {
            toast.error(`Please select at least one option from "${group.name}"`);
            return;
          }
        }
      }
    }

    const selectedSize = selectedItem.sizes?.find(s => s.id === selectedSizeId);
    const optionsArray: OrderItemOption[] = Array.from(selectedOptions.values()).map(({ option, selectedSize }) => ({
      name: option.name,
      size: selectedSize?.name,
      price: selectedSize?.price ?? option.price_adjustment
    }));

    const totalPrice = calculateItemPrice();
    
    // Build display name
    let displayName = selectedItem.name;
    if (selectedSize) {
      displayName += ` (${selectedSize.name})`;
    }
    if (optionsArray.length > 0) {
      const optionNames = optionsArray.map(o => o.size ? `${o.name} ${o.size}` : o.name).join(", ");
      displayName += ` + ${optionNames}`;
    }

    // Create unique key for deduplication
    const optionKey = optionsArray.map(o => `${o.name}-${o.size || ''}`).sort().join('|');
    const uniqueKey = `${selectedItem.id}-${selectedSizeId || ''}-${optionKey}`;

    // Check if exact same item exists
    const existingIndex = orderItems.findIndex(oi => {
      const oiOptionKey = (oi.options || []).map(o => `${o.name}-${o.size || ''}`).sort().join('|');
      const oiKey = `${oi.item_id}-${oi.size_id || ''}-${oiOptionKey}`;
      return oiKey === uniqueKey;
    });

    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        item_id: selectedItem.id,
        name: displayName,
        quantity: 1,
        price: totalPrice,
        size_id: selectedSizeId || undefined,
        size_name: selectedSize?.name,
        options: optionsArray.length > 0 ? optionsArray : undefined
      }]);
    }

    setCustomizeDialogOpen(false);
    setSelectedItem(null);
    setSelectedSizeId("");
    setSelectedOptions(new Map());
  };

  const addItem = (item: MenuItem) => {
    const existingIndex = orderItems.findIndex(oi => 
      oi.item_id === item.id && !oi.size_id && (!oi.options || oi.options.length === 0)
    );
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

  const getUniqueItemKey = (item: OrderItem, index: number) => {
    const optionKey = (item.options || []).map(o => `${o.name}-${o.size || ''}`).sort().join('|');
    return `${item.item_id}-${item.size_id || ''}-${optionKey}-${index}`;
  };

  const updateQuantity = (targetIndex: number, delta: number) => {
    setOrderItems(prev => {
      const updated = prev.map((oi, idx) => {
        if (idx === targetIndex) {
          const newQty = oi.quantity + delta;
          return newQty > 0 ? { ...oi, quantity: newQty } : oi;
        }
        return oi;
      }).filter(oi => oi.quantity > 0);
      return updated;
    });
  };

  const removeItem = (targetIndex: number) => {
    setOrderItems(prev => prev.filter((_, idx) => idx !== targetIndex));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const generateOrderNumber = () => {
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
                    <div key={getUniqueItemKey(item, index)} className="flex items-center justify-between p-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{item.name}</span>
                        {item.options && item.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.options.map((opt, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {opt.name}{opt.size ? ` (${opt.size})` : ""}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <span className="text-muted-foreground ml-2 text-sm">
                          {getCurrencySymbol()}{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(index, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(index)}
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

      {/* Customization Dialog */}
      <Dialog open={customizeDialogOpen} onOpenChange={setCustomizeDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-6">
              {/* Size Selection */}
              {selectedItem?.has_sizes && selectedItem.sizes && selectedItem.sizes.length > 0 && (
                <div className="space-y-3">
                  <Label className="font-semibold">Size</Label>
                  <RadioGroup value={selectedSizeId} onValueChange={setSelectedSizeId}>
                    {selectedItem.sizes.map((size) => (
                      <div key={size.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={size.id} id={`size-${size.id}`} />
                          <Label htmlFor={`size-${size.id}`} className="cursor-pointer">{size.name}</Label>
                        </div>
                        <span className="font-medium">{getCurrencySymbol()}{size.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Option Groups (Sides/Extras) */}
              {selectedItem?.option_groups?.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div>
                    <Label className="font-semibold">{group.name}</Label>
                    {group.is_required && (
                      <span className="text-xs text-destructive ml-2">Required</span>
                    )}
                    {group.max_selections && group.max_selections > 1 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Select up to {group.max_selections})
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.options.map((option) => {
                      const isSelected = selectedOptions.has(option.id);
                      const selectedOption = selectedOptions.get(option.id);
                      
                      return (
                        <div key={option.id} className="space-y-2">
                          <div 
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted"
                            }`}
                            onClick={() => toggleOption(option)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <span>{option.name}</span>
                            </div>
                            {!option.has_sizes && option.price_adjustment > 0 && (
                              <span className="text-sm">+{getCurrencySymbol()}{option.price_adjustment.toFixed(2)}</span>
                            )}
                            {option.has_sizes && option.sizes && (
                              <span className="text-sm text-muted-foreground">
                                from +{getCurrencySymbol()}{Math.min(...option.sizes.map(s => s.price)).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Option Size Selection */}
                          {isSelected && option.has_sizes && option.sizes && option.sizes.length > 0 && (
                            <div className="ml-8 pl-4 border-l space-y-1">
                              {option.sizes.map((size) => (
                                <div
                                  key={size.id}
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                    selectedOption?.selectedSize?.id === size.id
                                      ? "bg-primary/10 border border-primary"
                                      : "bg-muted hover:bg-muted/80"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOptionSize(option.id, size);
                                  }}
                                >
                                  <span className="text-sm">{size.name}</span>
                                  <span className="text-sm font-medium">+{getCurrencySymbol()}{size.price.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Item Total</span>
              <span className="font-semibold text-lg">{getCurrencySymbol()}{calculateItemPrice().toFixed(2)}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomizeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCustomizeConfirm}>
                Add to Order
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
