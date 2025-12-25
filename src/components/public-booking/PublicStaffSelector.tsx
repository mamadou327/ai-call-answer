import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, ArrowLeft, Users } from "lucide-react";

interface Staff {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  deposit_required: boolean;
  deposit_amount: number | null;
}

interface PublicStaffSelectorProps {
  staff: Staff[];
  selectedService: Service;
  currency: string;
  onSelect: (staff: Staff | null) => void;
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

export const PublicStaffSelector = ({
  staff,
  selectedService,
  currency,
  onSelect,
  onBack,
}: PublicStaffSelectorProps) => {
  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to services
      </Button>

      {/* Selected service summary */}
      <Card className="border-2 border-primary shadow-sm bg-secondary">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-semibold">{selectedService.name}</h4>
              <p className="text-sm text-muted-foreground">
                {selectedService.duration_minutes} minutes
              </p>
            </div>
            <div className="font-bold">
              {formatCurrency(selectedService.price, currency)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-2">Choose Staff (Optional)</h2>
        <p className="text-muted-foreground">
          Select a specific staff member or let us assign one for you
        </p>
      </div>

      <div className="grid gap-3">
        {/* No preference option */}
        <Card
          className="border-2 border-primary shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(null)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">No Preference</h4>
                <p className="text-sm text-muted-foreground">
                  Any available staff member
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff members */}
        {staff.map((staffMember) => (
          <Card
            key={staffMember.id}
            className="border-2 border-primary shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelect(staffMember)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">{staffMember.name}</h4>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
