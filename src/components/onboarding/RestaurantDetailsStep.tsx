import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface RestaurantDetailsStepProps {
  businessId: string | null;
  businessType: string;
  formData: {
    cuisineType: string;
    menuLink: string;
    averagePrepTime: number;
    tableCount: number;
    paymentMethods: string[];
    requirePrepayment: boolean;
    prepaymentType: string;
    minimumOrderAmount: number;
    refundPolicy: string;
    refundWindowHours: number;
    reservationPlatform?: string;
  };
  updateFormData: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const cuisineTypes = [
  "Italian", "Indian", "Chinese", "Thai", "Japanese", "Mexican", 
  "American", "Mediterranean", "French", "Korean", "Vietnamese",
  "Middle Eastern", "Fast Food", "Pizza", "Burger", "Seafood", 
  "Steakhouse", "Vegetarian/Vegan", "Cafe/Bakery", "Other"
];

const RestaurantDetailsStep = ({
  businessId,
  businessType,
  formData,
  updateFormData,
  onNext,
  onBack,
}: RestaurantDetailsStepProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const showDineIn = businessType === "restaurant_dine_in" || businessType === "restaurant_hybrid";
  const showPickup = businessType === "restaurant_pickup" || businessType === "restaurant_hybrid";

  const handlePaymentMethodChange = (method: string, checked: boolean) => {
    const current = formData.paymentMethods || [];
    if (checked) {
      updateFormData({ paymentMethods: [...current, method] });
    } else {
      updateFormData({ paymentMethods: current.filter((m: string) => m !== method) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      toast({ title: "Error", description: "Business not found", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          cuisine_type: formData.cuisineType || null,
          menu_link: formData.menuLink || null,
          average_prep_time_minutes: formData.averagePrepTime || 30,
          payment_methods: formData.paymentMethods?.length > 0 ? formData.paymentMethods : ["card"],
          require_prepayment: formData.requirePrepayment || false,
          prepayment_type: formData.prepaymentType || "none",
          minimum_order_amount: formData.minimumOrderAmount || null,
          refund_policy: formData.refundPolicy || "full_refund",
          refund_window_hours: formData.refundWindowHours || 2,
          reservation_platform: formData.reservationPlatform || "none",
        })
        .eq("id", businessId);

      if (error) throw error;

      // If dine-in, create some default tables
      if (showDineIn && formData.tableCount > 0) {
        const tables = Array.from({ length: formData.tableCount }, (_, i) => ({
          business_id: businessId,
          table_number: `Table ${i + 1}`,
          capacity: 4,
          location: "indoor",
        }));

        await supabase.from("restaurant_tables").insert(tables);
      }

      onNext();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Restaurant Details</CardTitle>
        <CardDescription>
          Tell us more about your restaurant to help Aivia assist your customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cuisine Type */}
          <div className="space-y-2">
            <Label htmlFor="cuisineType">Cuisine Type</Label>
            <Select
              value={formData.cuisineType}
              onValueChange={(value) => updateFormData({ cuisineType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cuisine type" />
              </SelectTrigger>
              <SelectContent>
                {cuisineTypes.map((type) => (
                  <SelectItem key={type} value={type.toLowerCase().replace(/\//g, "_")}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
          </Select>
          </div>

          {/* Reservation Platform */}
          {showDineIn && (
            <div className="space-y-2">
              <Label>Current Reservation System</Label>
              <Select
                value={formData.reservationPlatform || "none"}
                onValueChange={(value) => updateFormData({ reservationPlatform: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your current system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — I'll use AIVIA</SelectItem>
                  <SelectItem value="opentable">OpenTable</SelectItem>
                  <SelectItem value="sevenrooms">SevenRooms</SelectItem>
                  <SelectItem value="resy">Resy</SelectItem>
                  <SelectItem value="tock">Tock</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If you use an external system, AIVIA will capture reservations and notify you to enter them manually
              </p>
            </div>
          )

          {/* Menu Link */}
          <div className="space-y-2">
            <Label htmlFor="menuLink">Menu Link (Optional)</Label>
            <Input
              id="menuLink"
              type="url"
              placeholder="https://yourrestaurant.com/menu"
              value={formData.menuLink}
              onChange={(e) => updateFormData({ menuLink: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Link to your online menu - Aivia can reference this for customers
            </p>
          </div>

          {/* Average Prep Time - Only for pickup */}
          {showPickup && (
            <div className="space-y-2">
              <Label htmlFor="averagePrepTime">Average Preparation Time (minutes)</Label>
              <Input
                id="averagePrepTime"
                type="number"
                min={5}
                max={120}
                value={formData.averagePrepTime || 30}
                onChange={(e) => updateFormData({ averagePrepTime: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-muted-foreground">
                Typical time to prepare an order for collection
              </p>
            </div>
          )}

          {/* Table Count - Only for dine-in */}
          {showDineIn && (
            <div className="space-y-2">
              <Label htmlFor="tableCount">Number of Tables</Label>
              <Input
                id="tableCount"
                type="number"
                min={1}
                max={100}
                value={formData.tableCount || 10}
                onChange={(e) => updateFormData({ tableCount: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                You can customize individual tables later in settings
              </p>
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Accepted Payment Methods</Label>
            <div className="flex flex-wrap gap-4">
              {["cash", "card", "online"].map((method) => (
                <div key={method} className="flex items-center space-x-2">
                  <Checkbox
                    id={`payment-${method}`}
                    checked={formData.paymentMethods?.includes(method)}
                    onCheckedChange={(checked) => handlePaymentMethodChange(method, !!checked)}
                  />
                  <Label htmlFor={`payment-${method}`} className="capitalize">
                    {method === "online" ? "Online Payment" : method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Prepayment Settings - Only for pickup */}
          {showPickup && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requirePrepayment"
                  checked={formData.requirePrepayment}
                  onCheckedChange={(checked) => updateFormData({ requirePrepayment: !!checked })}
                />
                <Label htmlFor="requirePrepayment">Require prepayment for pickup orders</Label>
              </div>

              {formData.requirePrepayment && (
                <div className="space-y-2 pl-6">
                  <Label>Prepayment Type</Label>
                  <Select
                    value={formData.prepaymentType}
                    onValueChange={(value) => updateFormData({ prepaymentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full payment required</SelectItem>
                      <SelectItem value="deposit">Deposit only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Minimum Order Amount - Only for pickup */}
          {showPickup && (
            <div className="space-y-2">
              <Label htmlFor="minimumOrderAmount">Minimum Order Amount (Optional)</Label>
              <Input
                id="minimumOrderAmount"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={formData.minimumOrderAmount || ""}
                onChange={(e) => updateFormData({ minimumOrderAmount: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no minimum order requirement
              </p>
            </div>
          )}

          {/* Refund Policy */}
          <div className="space-y-2">
            <Label>Refund Policy</Label>
            <Select
              value={formData.refundPolicy || "full_refund"}
              onValueChange={(value) => updateFormData({ refundPolicy: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_refund">Full refund</SelectItem>
                <SelectItem value="partial_refund">Partial refund (50%)</SelectItem>
                <SelectItem value="store_credit">Store credit only</SelectItem>
                <SelectItem value="no_refund">No refunds</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="refundWindowHours" className="text-sm whitespace-nowrap">
                Cancellation window:
              </Label>
              <Input
                id="refundWindowHours"
                type="number"
                min={0}
                max={48}
                className="w-20"
                value={formData.refundWindowHours || 2}
                onChange={(e) => updateFormData({ refundWindowHours: parseInt(e.target.value) || 2 })}
              />
              <span className="text-sm text-muted-foreground">hours before order/reservation</span>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RestaurantDetailsStep;
