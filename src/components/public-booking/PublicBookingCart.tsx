import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ShoppingBag, Clock, User, Calendar } from "lucide-react";
import { format } from "date-fns";

interface CartItem {
  id: string;
  service: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    deposit_required: boolean;
    deposit_amount: number | null;
  };
  staff: { id: string; name: string } | null;
  date: Date | null;
  time: string | null;
}

interface PublicBookingCartProps {
  items: CartItem[];
  currency: string;
  onRemoveItem: (itemId: string) => void;
  onContinue: () => void;
  onAddAnother: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicBookingCart = ({
  items,
  currency,
  onRemoveItem,
  onContinue,
  onAddAnother,
}: PublicBookingCartProps) => {
  const totalPrice = items.reduce((sum, item) => sum + item.service.price, 0);
  const totalDeposit = items.reduce(
    (sum, item) =>
      sum + (item.service.deposit_required && item.service.deposit_amount ? item.service.deposit_amount : 0),
    0
  );
  const totalDuration = items.reduce((sum, item) => sum + item.service.duration_minutes, 0);

  // Check if all items are complete (have date/time)
  const allComplete = items.every((item) => item.date && item.time);

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-primary shadow-lg sticky bottom-4 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Your Booking ({items.length} {items.length === 1 ? "service" : "services"})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 pb-2 border-b last:border-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.service.name}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.service.duration_minutes} min
                </span>
                {item.staff && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {item.staff.name}
                  </span>
                )}
                {item.date && item.time && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(item.date, "MMM d")} at {item.time}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{formatCurrency(item.service.price, currency)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRemoveItem(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total duration</span>
            <span>{totalDuration} min</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(totalPrice, currency)}</span>
          </div>
          {totalDeposit > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Deposit required</span>
              <span>{formatCurrency(totalDeposit, currency)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onAddAnother}>
            Add Another
          </Button>
          <Button className="flex-1" onClick={onContinue} disabled={!allComplete && items.length > 0}>
            {allComplete ? "Continue" : "Complete All"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
