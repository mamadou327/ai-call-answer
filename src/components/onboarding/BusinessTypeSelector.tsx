import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, UtensilsCrossed, Store, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BusinessType = "salon" | "restaurant_pickup" | "restaurant_dine_in" | "restaurant_hybrid";

interface BusinessTypeSelectorProps {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
  onNext: () => void;
  onBack: () => void;
}

const businessTypes: { value: BusinessType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "salon",
    label: "Salon / Barbershop / Spa",
    description: "Appointment-based services with staff scheduling",
    icon: <Scissors className="w-8 h-8" />,
  },
  {
    value: "restaurant_pickup",
    label: "Restaurant (Pickup/Takeaway)",
    description: "Food orders for customer collection",
    icon: <Store className="w-8 h-8" />,
  },
  {
    value: "restaurant_dine_in",
    label: "Restaurant (Dine-in)",
    description: "Table reservations for seated dining",
    icon: <UtensilsCrossed className="w-8 h-8" />,
  },
  {
    value: "restaurant_hybrid",
    label: "Restaurant (Pickup & Dine-in)",
    description: "Both pickup orders and table reservations",
    icon: <Building2 className="w-8 h-8" />,
  },
];

const BusinessTypeSelector = ({ value, onChange, onNext, onBack }: BusinessTypeSelectorProps) => {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>What type of business are you?</CardTitle>
        <CardDescription>
          This helps Aivia provide the right AI assistant experience for your customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {businessTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                value === type.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-lg",
                  value === type.value ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {type.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{type.label}</h3>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessTypeSelector;
