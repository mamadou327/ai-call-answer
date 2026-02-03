import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Clock, Plus, Minus, Leaf, Wheat, Milk } from "lucide-react";

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  dietary_tags: string[] | null;
  is_available: boolean;
  has_sizes: boolean;
  preparation_time_minutes: number | null;
  image_url: string | null;
  sizes?: MenuItemSize[];
  option_groups?: MenuItemOptionGroup[];
}

export interface MenuItemSize {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

export interface MenuItemOptionGroup {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  min_selections: number | null;
  max_selections: number | null;
  options: MenuItemOption[];
}

export interface MenuItemOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  has_sizes: boolean;
  sizes?: OptionSize[];
}

export interface OptionSize {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
}

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  selectedSize?: MenuItemSize;
  selectedOptions: Array<{
    option: MenuItemOption;
    selectedSize?: OptionSize;
  }>;
  specialInstructions?: string;
  unitPrice: number;
}

interface PublicMenuSelectorProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  currency: string;
  orderItems: OrderItem[];
  onAddToOrder: (item: OrderItem) => void;
  onBack: () => void;
  minimumOrder?: number;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${amount.toFixed(2)}`;
};

const getDietaryIcon = (tag: string) => {
  switch (tag.toLowerCase()) {
    case "vegetarian":
    case "vegan":
      return <Leaf className="h-3 w-3" />;
    case "gluten-free":
      return <Wheat className="h-3 w-3" />;
    case "dairy-free":
      return <Milk className="h-3 w-3" />;
    default:
      return null;
  }
};

export const PublicMenuSelector = ({
  categories,
  menuItems,
  currency,
  orderItems,
  onAddToOrder,
  onBack,
  minimumOrder,
}: PublicMenuSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<MenuItemSize | undefined>();
  const [selectedOptions, setSelectedOptions] = useState<Map<string, { option: MenuItemOption; size?: OptionSize }>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Group items by category
  const itemsByCategory = menuItems.reduce((acc, item) => {
    const catId = item.category_id || "uncategorized";
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Sort categories by display_order
  const sortedCategories = [...categories].sort((a, b) => 
    (a.display_order || 0) - (b.display_order || 0)
  );

  const handleItemClick = (item: MenuItem) => {
    setCustomizeItem(item);
    setQuantity(1);
    setSpecialInstructions("");
    
    // Set default size if has sizes
    if (item.has_sizes && item.sizes?.length) {
      const defaultSize = item.sizes.find(s => s.is_default) || item.sizes[0];
      setSelectedSize(defaultSize);
    } else {
      setSelectedSize(undefined);
    }
    
    // Set default options
    const defaultOptions = new Map<string, { option: MenuItemOption; size?: OptionSize }>();
    item.option_groups?.forEach(group => {
      group.options.forEach(opt => {
        if (opt.is_default) {
          const defaultOptSize = opt.has_sizes && opt.sizes?.length 
            ? (opt.sizes.find(s => s.is_default) || opt.sizes[0])
            : undefined;
          defaultOptions.set(opt.id, { option: opt, size: defaultOptSize });
        }
      });
    });
    setSelectedOptions(defaultOptions);
  };

  const calculateItemPrice = () => {
    if (!customizeItem) return 0;
    
    let basePrice = selectedSize?.price ?? customizeItem.price;
    
    selectedOptions.forEach(({ option, size }) => {
      if (size) {
        basePrice += size.price;
      } else {
        basePrice += option.price_adjustment;
      }
    });
    
    return basePrice * quantity;
  };

  const handleAddToOrder = () => {
    if (!customizeItem) return;
    
    const unitPrice = calculateItemPrice() / quantity;
    
    const orderItem: OrderItem = {
      id: crypto.randomUUID(),
      menuItem: customizeItem,
      quantity,
      selectedSize,
      selectedOptions: Array.from(selectedOptions.values()),
      specialInstructions: specialInstructions.trim() || undefined,
      unitPrice,
    };
    
    onAddToOrder(orderItem);
    setCustomizeItem(null);
  };

  const toggleOption = (group: MenuItemOptionGroup, option: MenuItemOption) => {
    const newOptions = new Map(selectedOptions);
    
    if (group.max_selections === 1) {
      // Radio-style: remove other options from this group
      group.options.forEach(o => newOptions.delete(o.id));
      if (!selectedOptions.has(option.id)) {
        const defaultSize = option.has_sizes && option.sizes?.length 
          ? (option.sizes.find(s => s.is_default) || option.sizes[0])
          : undefined;
        newOptions.set(option.id, { option, size: defaultSize });
      }
    } else {
      // Checkbox-style: toggle
      if (newOptions.has(option.id)) {
        newOptions.delete(option.id);
      } else {
        const maxSelections = group.max_selections || Infinity;
        const currentGroupSelections = group.options.filter(o => newOptions.has(o.id)).length;
        if (currentGroupSelections < maxSelections) {
          const defaultSize = option.has_sizes && option.sizes?.length 
            ? (option.sizes.find(s => s.is_default) || option.sizes[0])
            : undefined;
          newOptions.set(option.id, { option, size: defaultSize });
        }
      }
    }
    
    setSelectedOptions(newOptions);
  };

  const setOptionSize = (optionId: string, size: OptionSize) => {
    const current = selectedOptions.get(optionId);
    if (current) {
      setSelectedOptions(new Map(selectedOptions).set(optionId, { ...current, size }));
    }
  };

  const orderTotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Category view
  if (!selectedCategory) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        
        <h2 className="text-2xl font-bold">Our Menu</h2>
        
        {minimumOrder && orderTotal < minimumOrder && (
          <div className="bg-muted p-3 rounded-lg text-sm">
            Minimum order: {formatCurrency(minimumOrder, currency)}
          </div>
        )}
        
        <div className="grid gap-4">
          {sortedCategories.map(category => {
            const categoryItems = itemsByCategory[category.id] || [];
            if (categoryItems.length === 0) return null;
            
            return (
              <Card 
                key={category.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedCategory(category.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        {categoryItems.length} item{categoryItems.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Uncategorized items */}
          {itemsByCategory["uncategorized"]?.length > 0 && (
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedCategory("uncategorized")}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">Other Items</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {itemsByCategory["uncategorized"].length} item{itemsByCategory["uncategorized"].length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Items in selected category
  const categoryName = selectedCategory === "uncategorized" 
    ? "Other Items" 
    : categories.find(c => c.id === selectedCategory)?.name || "Menu";
  const items = itemsByCategory[selectedCategory] || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => setSelectedCategory(null)} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Categories
      </Button>
      
      <h2 className="text-2xl font-bold">{categoryName}</h2>
      
      <div className="grid gap-3">
        {items.map(item => (
          <Card 
            key={item.id} 
            className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
            onClick={() => handleItemClick(item)}
          >
            <CardContent className="p-0">
              <div className="flex">
                {/* Item image - shown to customers */}
                {item.image_url && (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 p-4 flex justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.dietary_tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs flex items-center gap-1">
                          {getDietaryIcon(tag)}
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {item.preparation_time_minutes && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Clock className="h-3 w-3" />
                        {item.preparation_time_minutes} min
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">
                      {item.has_sizes && item.sizes?.length 
                        ? `from ${formatCurrency(Math.min(...item.sizes.map(s => s.price)), currency)}`
                        : formatCurrency(item.price, currency)
                      }
                    </p>
                    {item.option_groups && item.option_groups.length > 0 && (
                      <p className="text-xs text-muted-foreground">Customizable</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customization Dialog */}
      <Dialog open={!!customizeItem} onOpenChange={(open) => !open && setCustomizeItem(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{customizeItem?.name}</DialogTitle>
          </DialogHeader>
          
          {customizeItem && (
            <div className="space-y-6">
              {/* Item image in modal */}
              {customizeItem.image_url && (
                <div className="w-full h-40 -mt-2 rounded-lg overflow-hidden">
                  <img 
                    src={customizeItem.image_url} 
                    alt={customizeItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {customizeItem.description && (
                <p className="text-sm text-muted-foreground">{customizeItem.description}</p>
              )}
              
              {/* Size selection */}
              {customizeItem.has_sizes && customizeItem.sizes && customizeItem.sizes.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold">Size</Label>
                  <RadioGroup 
                    value={selectedSize?.id} 
                    onValueChange={(val) => setSelectedSize(customizeItem.sizes!.find(s => s.id === val))}
                  >
                    {customizeItem.sizes.map(size => (
                      <div key={size.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={size.id} id={size.id} />
                          <Label htmlFor={size.id} className="cursor-pointer">{size.name}</Label>
                        </div>
                        <span className="text-sm">{formatCurrency(size.price, currency)}</span>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
              
              {/* Option groups (sides, extras, etc.) */}
              {customizeItem.option_groups?.map(group => (
                <div key={group.id} className="space-y-2">
                  <div>
                    <Label className="font-semibold">{group.name}</Label>
                    {group.is_required && <span className="text-destructive ml-1">*</span>}
                    {group.description && (
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    )}
                    {group.max_selections && group.max_selections > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Select up to {group.max_selections}
                      </p>
                    )}
                  </div>
                  
                  {group.max_selections === 1 ? (
                    <RadioGroup 
                      value={group.options.find(o => selectedOptions.has(o.id))?.id}
                      onValueChange={(val) => {
                        const opt = group.options.find(o => o.id === val);
                        if (opt) toggleOption(group, opt);
                      }}
                    >
                      {group.options.map(option => (
                        <div key={option.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value={option.id} id={option.id} />
                              <Label htmlFor={option.id} className="cursor-pointer">{option.name}</Label>
                            </div>
                            {option.has_sizes && option.sizes?.length ? (
                              <span className="text-sm text-muted-foreground">from +{formatCurrency(Math.min(...option.sizes.map(s => s.price)), currency)}</span>
                            ) : option.price_adjustment !== 0 && (
                              <span className="text-sm">
                                {option.price_adjustment > 0 ? "+" : ""}{formatCurrency(option.price_adjustment, currency)}
                              </span>
                            )}
                          </div>
                          
                          {/* Option size selection */}
                          {option.has_sizes && option.sizes && selectedOptions.has(option.id) && (
                            <div className="ml-6 pl-4 border-l space-y-1">
                              {option.sizes.map(size => (
                                <div 
                                  key={size.id} 
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                                    selectedOptions.get(option.id)?.size?.id === size.id 
                                      ? "bg-primary/10 border border-primary" 
                                      : "bg-muted hover:bg-muted/80"
                                  }`}
                                  onClick={() => setOptionSize(option.id, size)}
                                >
                                  <span className="text-sm">{size.name}</span>
                                  <span className="text-sm font-medium">+{formatCurrency(size.price, currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {group.options.map(option => (
                        <div key={option.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                id={option.id} 
                                checked={selectedOptions.has(option.id)}
                                onCheckedChange={() => toggleOption(group, option)}
                              />
                              <Label htmlFor={option.id} className="cursor-pointer">{option.name}</Label>
                            </div>
                            {option.has_sizes && option.sizes?.length ? (
                              <span className="text-sm text-muted-foreground">from +{formatCurrency(Math.min(...option.sizes.map(s => s.price)), currency)}</span>
                            ) : option.price_adjustment !== 0 && (
                              <span className="text-sm">
                                {option.price_adjustment > 0 ? "+" : ""}{formatCurrency(option.price_adjustment, currency)}
                              </span>
                            )}
                          </div>
                          
                          {/* Option size selection */}
                          {option.has_sizes && option.sizes && selectedOptions.has(option.id) && (
                            <div className="ml-6 pl-4 border-l space-y-1">
                              {option.sizes.map(size => (
                                <div 
                                  key={size.id} 
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                                    selectedOptions.get(option.id)?.size?.id === size.id 
                                      ? "bg-primary/10 border border-primary" 
                                      : "bg-muted hover:bg-muted/80"
                                  }`}
                                  onClick={() => setOptionSize(option.id, size)}
                                >
                                  <span className="text-sm">{size.name}</span>
                                  <span className="text-sm font-medium">+{formatCurrency(size.price, currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Special instructions */}
              <div className="space-y-2">
                <Label>Special Instructions</Label>
                <Textarea 
                  placeholder="Any special requests? (allergies, preferences, etc.)"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                />
              </div>
              
              {/* Quantity */}
              <div className="flex items-center justify-between">
                <Label>Quantity</Label>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={handleAddToOrder} className="w-full">
              Add to Order • {formatCurrency(calculateItemPrice(), currency)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
