import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export type BusinessCategory = "salon" | "restaurant";

interface BusinessCategorySelectorProps {
  onSelect: (category: BusinessCategory) => void;
}

const categories: { value: BusinessCategory; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "salon",
    label: "Salon / Barbershop / Spa",
    description: "Appointment-based services with staff scheduling",
    icon: <Scissors className="w-8 h-8" />,
  },
  {
    value: "restaurant",
    label: "Restaurant",
    description: "Food orders, table reservations, or both",
    icon: <UtensilsCrossed className="w-8 h-8" />,
  },
];

const BusinessCategorySelector = ({ onSelect }: BusinessCategorySelectorProps) => {
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
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => onSelect(category.value)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="p-3 rounded-lg bg-muted">
                {category.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{category.label}</h3>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessCategorySelector;
