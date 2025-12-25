import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign } from "lucide-react";

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
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicServiceSelector = ({
  services,
  currency,
  onSelect,
}: PublicServiceSelectorProps) => {
  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const categories = Object.keys(servicesByCategory).sort();

  if (services.length === 0) {
    return (
      <Card className="border-2 border-primary shadow-sm">
        <CardHeader>
          <CardTitle>No Services Available</CardTitle>
          <CardDescription>
            This business hasn't added any services yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Select a Service</h2>
        <p className="text-muted-foreground">
          Choose the service you'd like to book
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="font-semibold text-lg">{category}</h3>
          <div className="grid gap-3">
            {servicesByCategory[category].map((service) => (
              <Card
                key={service.id}
                className="border-2 border-primary shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSelect(service)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{service.name}</h4>
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
                      <div className="font-bold text-lg">
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
      ))}
    </div>
  );
};
