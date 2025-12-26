import { Card, CardContent } from "@/components/ui/card";
import { Clock, ChevronDown, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  description: string | null;
  deposit_required: boolean;
  deposit_amount: number | null;
}

interface PublicServiceSelectorProps {
  services: Service[];
  currency: string;
  onSelect: (service: Service) => void;
  onBack: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

// Define category display order - categories not in this list will appear at the end alphabetically
const CATEGORY_ORDER = [
  "men",
  "adults", 
  "men/adults",
  "kids",
  "hairstyle",
  "hairstyles",
  "women",
  "color",
  "treatment",
  "unisex",
  "other",
];

const getCategoryOrder = (category: string): number => {
  const lowerCategory = category.toLowerCase();
  const index = CATEGORY_ORDER.findIndex(c => lowerCategory.includes(c) || c.includes(lowerCategory));
  return index === -1 ? CATEGORY_ORDER.length : index;
};

const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const PublicServiceSelector = ({
  services,
  currency,
  onSelect,
  onBack,
}: PublicServiceSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Sort categories by predefined order
  const categories = Object.keys(servicesByCategory).sort((a, b) => {
    const orderA = getCategoryOrder(a);
    const orderB = getCategoryOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  if (services.length === 0) {
    return (
      <Card className="border-2 border-primary shadow-sm">
        <CardContent className="pt-6 text-center">
          <h3 className="font-semibold text-lg">No Services Available</h3>
          <p className="text-muted-foreground mt-2">
            This business hasn't added any services yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button when on category view */}
      {!selectedCategory && (
        <Button variant="outline" onClick={onBack} className="gap-2 mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Our Services</h2>
        <p className="text-muted-foreground">
          {selectedCategory ? "Choose a service" : "Select a category to view services"}
        </p>
      </div>

      {/* Category Cards - shown when no category selected */}
      {!selectedCategory && (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <Card
              key={category}
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => setSelectedCategory(category)}
            >
              <CardContent className="p-6 flex flex-col justify-between min-h-[140px]">
                <h3 className="text-xl font-bold">{capitalizeFirstLetter(category)}</h3>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    {servicesByCategory[category].length} service{servicesByCategory[category].length !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-full group-hover:bg-primary/90 transition-colors">
                    View services
                    <ChevronDown className="h-4 w-4 -rotate-90" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Services List - shown when category is selected */}
      {selectedCategory && (
        <div className="space-y-4">
          {/* Back to categories button */}
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
            <span>Back to categories</span>
          </button>

          <div className="flex items-center gap-3 pb-2">
            <h3 className="text-xl font-bold">{capitalizeFirstLetter(selectedCategory)}</h3>
          </div>

          <div className="grid gap-3">
            {servicesByCategory[selectedCategory].map((service) => (
              <Card
                key={service.id}
                className="border-2 border-muted hover:border-primary cursor-pointer hover:shadow-md transition-all"
                onClick={() => onSelect(service)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{service.name}</h4>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{service.duration_minutes} min</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">
                        {formatCurrency(service.price, currency)}
                      </div>
                      {service.deposit_required && service.deposit_amount && (
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(service.deposit_amount, currency)} deposit
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
