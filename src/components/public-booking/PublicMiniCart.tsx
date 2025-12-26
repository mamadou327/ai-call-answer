import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CartItem } from "./PublicBookingCart";

interface PublicMiniCartProps {
  items: CartItem[];
  currency: string;
  onViewCart: () => void;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicMiniCart = ({ items, currency, onViewCart }: PublicMiniCartProps) => {
  if (items.length === 0) return null;

  const totalPrice = items.reduce((sum, item) => sum + item.service.price, 0);
  const completedItems = items.filter((item) => item.date && item.time).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
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
            Your Booking Cart
          </h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.service.name}</p>
                  {item.date && item.time ? (
                    <p className="text-xs text-muted-foreground">
                      {format(item.date, "MMM d")} at {item.time}
                      {item.staff && ` • ${item.staff.name}`}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">Pending time selection</p>
                  )}
                </div>
                <span className="font-medium ml-2">
                  {formatCurrency(item.service.price, currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-2 flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                {completedItems}/{items.length} scheduled
              </p>
              <p className="font-bold">{formatCurrency(totalPrice, currency)}</p>
            </div>
            <Button size="sm" onClick={onViewCart}>
              View Cart
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
