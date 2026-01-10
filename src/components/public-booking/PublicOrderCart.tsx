import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, ShoppingBag, Clock, MapPin } from "lucide-react";
import { OrderItem } from "./PublicMenuSelector";

interface PublicOrderCartProps {
  orderItems: OrderItem[];
  currency: string;
  businessName: string;
  businessAddress: string;
  minimumOrder?: number;
  deliveryEnabled?: boolean;
  deliveryFee?: number;
  deliveryMinimum?: number;
  averagePrepTime?: number;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onSubmit: (orderData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    orderType: "pickup" | "delivery";
    deliveryAddress?: string;
    pickupTime?: string;
    notes?: string;
  }) => void;
  onBack: () => void;
  onAddMore: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${amount.toFixed(2)}`;
};

export const PublicOrderCart = ({
  orderItems,
  currency,
  businessName,
  businessAddress,
  minimumOrder = 0,
  deliveryEnabled = false,
  deliveryFee = 0,
  deliveryMinimum = 0,
  averagePrepTime = 20,
  onRemoveItem,
  onUpdateQuantity,
  onSubmit,
  onBack,
  onAddMore,
}: PublicOrderCartProps) => {
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupTime, setPickupTime] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryCharge = orderType === "delivery" ? deliveryFee : 0;
  const total = subtotal + deliveryCharge;

  const meetsMinimum = orderType === "pickup" 
    ? subtotal >= minimumOrder
    : subtotal >= Math.max(minimumOrder, deliveryMinimum);

  const canSubmit = 
    customerName.trim() && 
    customerPhone.trim() && 
    orderItems.length > 0 && 
    meetsMinimum &&
    (orderType === "pickup" || deliveryAddress.trim()) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        orderType,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        pickupTime: pickupTime === "asap" ? undefined : scheduledTime,
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderItems.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Menu
        </Button>
        
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Your order is empty</h3>
            <p className="text-muted-foreground mb-4">Add some items to get started</p>
            <Button onClick={onAddMore}>Browse Menu</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Menu
      </Button>
      
      <h2 className="text-2xl font-bold">Your Order</h2>
      
      {/* Order Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderItems.map(item => (
            <div key={item.id} className="flex gap-4 py-3 border-b last:border-0">
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.menuItem.name}</p>
                    {item.selectedSize && (
                      <p className="text-sm text-muted-foreground">{item.selectedSize.name}</p>
                    )}
                    {item.selectedOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.selectedOptions.map(({ option, selectedSize }) => (
                          <Badge key={option.id} variant="secondary" className="text-xs">
                            {option.name}{selectedSize ? ` (${selectedSize.name})` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {item.specialInstructions}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(item.unitPrice * item.quantity, currency)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border rounded">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          <Button variant="outline" className="w-full" onClick={onAddMore}>
            Add More Items
          </Button>
        </CardContent>
      </Card>
      
      {/* Order Type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Order Type</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={orderType} onValueChange={(v) => setOrderType(v as "pickup" | "delivery")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pickup" id="pickup" />
              <Label htmlFor="pickup" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Pickup</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Ready in ~{averagePrepTime} minutes
                </p>
              </Label>
            </div>
            {deliveryEnabled && (
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Delivery</span>
                    {deliveryFee > 0 && (
                      <Badge variant="secondary">+{formatCurrency(deliveryFee, currency)}</Badge>
                    )}
                  </div>
                  {deliveryMinimum > 0 && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Minimum order: {formatCurrency(deliveryMinimum, currency)}
                    </p>
                  )}
                </Label>
              </div>
            )}
          </RadioGroup>
          
          {orderType === "pickup" && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{businessName}</p>
              <p className="text-xs text-muted-foreground">{businessAddress}</p>
            </div>
          )}
          
          {orderType === "delivery" && (
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="delivery-address">Delivery Address *</Label>
                <Textarea
                  id="delivery-address"
                  placeholder="Enter your full delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Pickup Time */}
      {orderType === "pickup" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pickup Time</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={pickupTime} onValueChange={(v) => setPickupTime(v as "asap" | "scheduled")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="asap" id="asap" />
                <Label htmlFor="asap" className="cursor-pointer">
                  As soon as possible (~{averagePrepTime} min)
                </Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="cursor-pointer">
                  Schedule for later
                </Label>
              </div>
            </RadioGroup>
            
            {pickupTime === "scheduled" && (
              <div className="mt-3">
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Customer Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Your phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="Your email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="notes">Order Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Order Total */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {orderType === "delivery" && deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span>Delivery</span>
              <span>{formatCurrency(deliveryFee, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
          
          {!meetsMinimum && (
            <p className="text-sm text-destructive">
              Minimum order: {formatCurrency(
                orderType === "pickup" ? minimumOrder : Math.max(minimumOrder, deliveryMinimum), 
                currency
              )}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Button 
        className="w-full" 
        size="lg"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Placing Order..." : `Place Order • ${formatCurrency(total, currency)}`}
      </Button>
    </div>
  );
};
