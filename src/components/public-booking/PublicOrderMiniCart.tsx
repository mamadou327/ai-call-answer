import { ShoppingBag, X, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { OrderItem } from "./PublicMenuSelector";

interface PublicOrderMiniCartProps {
  items: OrderItem[];
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

export const PublicOrderMiniCart = ({ 
  items, 
  currency, 
  onRemoveItem,
  onContinue,
  onAddAnother
}: PublicOrderMiniCartProps) => {
  const totalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
            {totalItems}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Your Order ({totalItems} {totalItems === 1 ? "item" : "items"})
          </h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 pb-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{item.menuItem.name}</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {item.selectedSize && (
                      <p>{item.selectedSize.name}</p>
                    )}
                    {item.selectedOptions.length > 0 && (
                      <p>
                        {item.selectedOptions.map(opt => 
                          opt.selectedSize 
                            ? `${opt.option.name} (${opt.selectedSize.name})`
                            : opt.option.name
                        ).join(", ")}
                      </p>
                    )}
                    <p>Qty: {item.quantity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs">
                    {formatCurrency(item.unitPrice * item.quantity, currency)}
                  </span>
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

          <div className="border-t pt-2">
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{formatCurrency(totalPrice, currency)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onAddAnother}>
              Add More
            </Button>
            <Button 
              size="sm"
              className="flex-1" 
              onClick={onContinue}
            >
              Checkout
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
