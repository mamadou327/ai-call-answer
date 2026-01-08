import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, UtensilsCrossed, Building2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessType } from "./BusinessTypeSelector";

interface RestaurantTypeSelectorProps {
  onSelect: (type: BusinessType) => void;
  onBack: () => void;
}

const restaurantTypes: { value: BusinessType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "restaurant_pickup",
    label: "Pickup / Takeaway only",
    description: "Take orders for customer collection",
    icon: <Store className="w-8 h-8" />,
  },
  {
    value: "restaurant_dine_in",
    label: "Dine-in only",
    description: "Table reservations for seated dining",
    icon: <UtensilsCrossed className="w-8 h-8" />,
  },
  {
    value: "restaurant_hybrid",
    label: "Both Pickup and Dine-in",
    description: "Accept both pickup orders and table reservations",
    icon: <Building2 className="w-8 h-8" />,
  },
];

const RestaurantTypeSelector = ({ onSelect, onBack }: RestaurantTypeSelectorProps) => {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>What type of restaurant?</CardTitle>
        <CardDescription>
          Choose how customers will interact with your restaurant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {restaurantTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onSelect(type.value)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="p-3 rounded-lg bg-muted">
                {type.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{type.label}</h3>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onBack} className="w-full mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </CardContent>
    </Card>
  );
};

export default RestaurantTypeSelector;
