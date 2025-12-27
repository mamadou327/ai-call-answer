import { ShoppingBag, X, Clock, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CartItem } from "./PublicBookingCart";

interface PublicMiniCartProps {
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

export const PublicMiniCart = ({ 
  items, 
  currency, 
  onRemoveItem,
  onContinue,
  onAddAnother
}: PublicMiniCartProps) => {
  const totalPrice = items.reduce((sum, item) => sum + item.service.price, 0);
  const totalDuration = items.reduce((sum, item) => sum + item.service.duration_minutes, 0);
  const allComplete = items.every((item) => item.date && item.time);
  const pendingItems = items.filter((item) => !item.date || !item.time);

  // Empty cart state - show black icon
  if (items.length === 0) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <ShoppingBag className="h-5 w-5 text-foreground" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingBag className="h-5 w-5" />
          <Badge 
            variant="default" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {items.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Your Booking ({items.length} {items.length === 1 ? "service" : "services"})
          </h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 pb-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{item.service.name}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
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
                    {item.date && item.time ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(item.date, "MMM d")} at {item.time}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Pending</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs">{formatCurrency(item.service.price, currency)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-2 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total duration</span>
              <span>{totalDuration} min</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{formatCurrency(totalPrice, currency)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onAddAnother}>
              Add Another
            </Button>
            <Button 
              size="sm"
              className="flex-1" 
              onClick={onContinue} 
              disabled={!allComplete}
            >
              {allComplete ? "Continue" : `Complete ${pendingItems.length}`}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
