import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UtensilsCrossed, FolderPlus, Loader2, GripVertical, Settings2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MenuItemOptionsDialog } from "./MenuItemOptionsDialog";
import { MenuImportDialog } from "./MenuImportDialog";

interface MenuManagementProps {
  businessId: string;
  onUpdate?: () => void;
  currency?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  preparation_time_minutes: number;
  is_available: boolean;
  dietary_tags: string[];
  display_order: number;
  hasOptions?: boolean;
  optionsSummary?: string;
  has_sizes?: boolean;
  sizes?: SizeVariant[];
}

interface SizeVariant {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
}

const SIZE_PRESETS = [
  { label: "Small / Large", sizes: ["Small", "Large"] },
  { label: "S / M / L", sizes: ["Small", "Medium", "Large"] },
  { label: "Regular / Large", sizes: ["Regular", "Large"] },
  { label: "Single / Double", sizes: ["Single", "Double"] },
];

const dietaryOptions = ["Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Dairy-Free", "Nut-Free"];

export const MenuManagement = ({ businessId, onUpdate, currency = "GBP" }: MenuManagementProps) => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [savingCategory, setSavingCategory] = useState(false);
  
  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    preparation_time_minutes: "15",
    dietary_tags: [] as string[],
    is_available: true,
    has_sizes: false,
    sizes: [] as { name: string; price: string; is_default: boolean }[],
  });
  const [savingItem, setSavingItem] = useState(false);
  const [sizeQuickEntry, setSizeQuickEntry] = useState("");
  
  // Options dialog state
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [selectedItemForOptions, setSelectedItemForOptions] = useState<MenuItem | null>(null);
  
  // Post-creation options prompt
  const [showOptionsPrompt, setShowOptionsPrompt] = useState(false);
  const [newlyCreatedItem, setNewlyCreatedItem] = useState<MenuItem | null>(null);
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

  useEffect(() => {
    loadMenu();
  }, [businessId]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("*")
          .eq("business_id", businessId)
          .order("display_order"),
        supabase
          .from("menu_items")
          .select("*")
          .eq("business_id", businessId)
          .order("display_order"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const menuItems = itemsRes.data || [];
      const itemIds = menuItems.map(i => i.id);
      
      // Fetch option groups and sizes in parallel
      let optionGroupsMap: Record<string, string[]> = {};
      let sizesMap: Record<string, SizeVariant[]> = {};
      
      if (itemIds.length > 0) {
        const [optionGroupsRes, sizesRes] = await Promise.all([
          supabase
            .from("menu_item_option_groups")
            .select("menu_item_id, name")
            .in("menu_item_id", itemIds)
            .order("display_order"),
          supabase
            .from("menu_item_sizes")
            .select("*")
            .in("menu_item_id", itemIds)
            .order("display_order"),
        ]);
        
        // Group option names by item
        optionGroupsRes.data?.forEach(g => {
          if (!optionGroupsMap[g.menu_item_id]) {
            optionGroupsMap[g.menu_item_id] = [];
          }
          optionGroupsMap[g.menu_item_id].push(g.name);
        });
        
        // Group sizes by item
        sizesRes.data?.forEach(s => {
          if (!sizesMap[s.menu_item_id]) {
            sizesMap[s.menu_item_id] = [];
          }
          sizesMap[s.menu_item_id].push({
            id: s.id,
            name: s.name,
            price: Number(s.price),
            is_default: s.is_default ?? false,
            is_available: s.is_available ?? true,
            display_order: s.display_order ?? 0,
          });
        });
      }

      setCategories(categoriesRes.data || []);
      setItems(menuItems.map(item => {
        const groupNames = optionGroupsMap[item.id] || [];
        const sizes = sizesMap[item.id] || [];
        let summary = "";
        if (groupNames.length === 1) {
          summary = groupNames[0];
        } else if (groupNames.length === 2) {
          summary = groupNames.join(", ");
        } else if (groupNames.length > 2) {
          summary = `${groupNames.slice(0, 2).join(", ")} (+${groupNames.length - 2} more)`;
        }
        return {
          ...item,
          hasOptions: groupNames.length > 0,
          optionsSummary: summary,
          has_sizes: item.has_sizes || false,
          sizes,
        };
      }));
    } catch (error: any) {
      console.error("Error loading menu:", error);
      toast({
        title: "Error",
        description: "Failed to load menu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleOpenCategoryDialog = (category?: MenuCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, description: category.description || "" });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("menu_categories")
          .update({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
          })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Category updated" });
      } else {
        const { error } = await supabase
          .from("menu_categories")
          .insert({
            business_id: businessId,
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            display_order: categories.length,
          });
        if (error) throw error;
        toast({ title: "Category created" });
      }
      setCategoryDialogOpen(false);
      loadMenu();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving category:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Delete this category? Items in this category will become uncategorized.")) return;
    
    try {
      const { error } = await supabase.from("menu_categories").delete().eq("id", categoryId);
      if (error) throw error;
      toast({ title: "Category deleted" });
      loadMenu();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Item handlers
  const handleOpenItemDialog = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      const formSizes = item.sizes?.map(s => ({
        name: s.name,
        price: s.price.toString(),
        is_default: s.is_default,
      })) || [];
      setItemForm({
        name: item.name,
        description: item.description || "",
        price: item.price.toString(),
        category_id: item.category_id || "",
        preparation_time_minutes: item.preparation_time_minutes.toString(),
        dietary_tags: item.dietary_tags || [],
        is_available: item.is_available,
        has_sizes: item.has_sizes || false,
        sizes: formSizes,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: "",
        description: "",
        price: "",
        category_id: categories[0]?.id || "",
        preparation_time_minutes: "15",
        dietary_tags: [],
        is_available: true,
        has_sizes: false,
        sizes: [],
      });
    }
    setSizeQuickEntry("");
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    
    // Validate: if has_sizes, need at least one size; otherwise need price
    if (itemForm.has_sizes) {
      if (itemForm.sizes.length === 0) {
        toast({ title: "Error", description: "Add at least one size variant", variant: "destructive" });
        return;
      }
      const invalidSize = itemForm.sizes.find(s => !s.name.trim() || !s.price);
      if (invalidSize) {
        toast({ title: "Error", description: "All sizes need a name and price", variant: "destructive" });
        return;
      }
    } else if (!itemForm.price) {
      toast({ title: "Error", description: "Price is required", variant: "destructive" });
      return;
    }

    setSavingItem(true);
    try {
      // For items with sizes, set base price to the lowest size price
      const basePrice = itemForm.has_sizes && itemForm.sizes.length > 0
        ? Math.min(...itemForm.sizes.map(s => parseFloat(s.price) || 0))
        : parseFloat(itemForm.price);
        
      const itemData = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        price: basePrice,
        category_id: itemForm.category_id || null,
        preparation_time_minutes: parseInt(itemForm.preparation_time_minutes) || 15,
        dietary_tags: itemForm.dietary_tags,
        is_available: itemForm.is_available,
        has_sizes: itemForm.has_sizes,
      };

      let savedItemId: string;

      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(itemData)
          .eq("id", editingItem.id);
        if (error) throw error;
        savedItemId = editingItem.id;
        
        // Handle sizes update
        if (itemForm.has_sizes) {
          // Delete existing sizes and re-insert
          await supabase.from("menu_item_sizes").delete().eq("menu_item_id", savedItemId);
          
          if (itemForm.sizes.length > 0) {
            const sizesToInsert = itemForm.sizes.map((s, idx) => ({
              menu_item_id: savedItemId,
              name: s.name.trim(),
              price: parseFloat(s.price),
              is_default: s.is_default || idx === 0,
              display_order: idx,
            }));
            const { error: sizesError } = await supabase.from("menu_item_sizes").insert(sizesToInsert);
            if (sizesError) throw sizesError;
          }
        } else {
          // Remove any existing sizes if switching to single price
          await supabase.from("menu_item_sizes").delete().eq("menu_item_id", savedItemId);
        }
        
        toast({ title: "Item updated" });
        setItemDialogOpen(false);
        loadMenu();
        onUpdate?.();
      } else {
        const { data, error } = await supabase
          .from("menu_items")
          .insert({
            ...itemData,
            business_id: businessId,
            display_order: items.length,
          })
          .select()
          .single();
        if (error) throw error;
        savedItemId = data.id;
        
        // Insert sizes if has_sizes
        if (itemForm.has_sizes && itemForm.sizes.length > 0) {
          const sizesToInsert = itemForm.sizes.map((s, idx) => ({
            menu_item_id: savedItemId,
            name: s.name.trim(),
            price: parseFloat(s.price),
            is_default: s.is_default || idx === 0,
            display_order: idx,
          }));
          const { error: sizesError } = await supabase.from("menu_item_sizes").insert(sizesToInsert);
          if (sizesError) throw sizesError;
        }
        
        toast({ title: "Item added" });
        setItemDialogOpen(false);
        
        // Prompt to add options for new item
        if (data) {
          setNewlyCreatedItem({
            ...data,
            hasOptions: false,
            optionsSummary: "",
          });
          setShowOptionsPrompt(true);
        }
        
        loadMenu();
        onUpdate?.();
      }
    } catch (error: any) {
      console.error("Error saving item:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingItem(false);
    }
  };

  // Size helper functions
  const applyPreset = (presetSizes: string[]) => {
    setItemForm(prev => ({
      ...prev,
      sizes: presetSizes.map((name, idx) => ({
        name,
        price: "",
        is_default: idx === 0,
      })),
    }));
  };

  const parseSizeQuickEntry = () => {
    if (!sizeQuickEntry.trim()) return;
    const lines = sizeQuickEntry.trim().split("\n");
    const newSizes: { name: string; price: string; is_default: boolean }[] = [];
    
    lines.forEach((line, idx) => {
      const parts = line.split(":").map(s => s.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const price = parts[1].replace(/[^0-9.]/g, "");
        if (name && price) {
          newSizes.push({ name, price, is_default: idx === 0 });
        }
      } else if (parts[0]) {
        newSizes.push({ name: parts[0], price: "", is_default: idx === 0 });
      }
    });
    
    if (newSizes.length > 0) {
      setItemForm(prev => ({ ...prev, sizes: newSizes }));
      setSizeQuickEntry("");
    }
  };

  const updateSize = (index: number, field: "name" | "price", value: string) => {
    setItemForm(prev => ({
      ...prev,
      sizes: prev.sizes.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const removeSize = (index: number) => {
    setItemForm(prev => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  const addSize = () => {
    setItemForm(prev => ({
      ...prev,
      sizes: [...prev.sizes, { name: "", price: "", is_default: prev.sizes.length === 0 }],
    }));
  };

  // Helper to render price display for an item
  const renderPriceDisplay = (item: MenuItem) => {
    if (item.has_sizes && item.sizes && item.sizes.length > 0) {
      // Show size prices inline
      const sortedSizes = [...item.sizes].sort((a, b) => a.display_order - b.display_order);
      if (sortedSizes.length <= 2) {
        return (
          <div className="flex flex-wrap gap-1 text-sm">
            {sortedSizes.map((s, idx) => (
              <span key={s.id} className="whitespace-nowrap">
                <span className="text-muted-foreground">{s.name}:</span>{" "}
                <span className="font-semibold">{currencySymbol}{s.price.toFixed(2)}</span>
                {idx < sortedSizes.length - 1 && <span className="text-muted-foreground mx-1">|</span>}
              </span>
            ))}
          </div>
        );
      } else {
        // Show first two and "+N more"
        return (
          <div className="flex flex-wrap gap-1 text-sm">
            {sortedSizes.slice(0, 2).map((s, idx) => (
              <span key={s.id} className="whitespace-nowrap">
                <span className="text-muted-foreground">{s.name}:</span>{" "}
                <span className="font-semibold">{currencySymbol}{s.price.toFixed(2)}</span>
                <span className="text-muted-foreground mx-1">|</span>
              </span>
            ))}
            <span className="text-muted-foreground text-xs">+{sortedSizes.length - 2} more</span>
          </div>
        );
      }
    }
    // Single price
    return <span className="font-semibold text-sm">{currencySymbol}{item.price.toFixed(2)}</span>;
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this menu item?")) return;
    
    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
      if (error) throw error;
      toast({ title: "Item deleted" });
      loadMenu();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", item.id);
      if (error) throw error;
      loadMenu();
    } catch (error: any) {
      console.error("Error toggling availability:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleOpenOptionsDialog = (item: MenuItem) => {
    setSelectedItemForOptions(item);
    setOptionsDialogOpen(true);
  };

  const toggleDietaryTag = (tag: string) => {
    setItemForm(prev => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter(t => t !== tag)
        : [...prev.dietary_tags, tag]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uncategorizedItems = items.filter(i => !i.category_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Menu Management</h3>
          <p className="text-sm text-muted-foreground">
            {categories.length} categories, {items.length} items
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => handleOpenCategoryDialog()}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                <DialogDescription>
                  Organize your menu items into categories
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category Name *</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="e.g., Starters, Main Course, Desserts"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveCategory} disabled={savingCategory}>
                  {savingCategory && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => handleOpenItemDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
          
          <Button size="sm" onClick={() => setImportDialogOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Import Menu
          </Button>
          
          <MenuImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            businessId={businessId}
            currency={currency}
            existingCategories={categories.map(c => ({ id: c.id, name: c.name }))}
            onImportComplete={loadMenu}
          />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Item" : "Add Menu Item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Item Name *</Label>
                  <Input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g., Chicken Shawarma"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    placeholder="Describe the dish..."
                    rows={2}
                  />
                </div>
                
                {/* Sizes quick-add or toggle */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Size variants</Label>
                      <p className="text-xs text-muted-foreground">Quick add sizes or toggle on</p>
                    </div>
                    <Switch
                      checked={itemForm.has_sizes}
                      onCheckedChange={(checked) => setItemForm({ ...itemForm, has_sizes: checked, sizes: checked && itemForm.sizes.length === 0 ? [{ name: "", price: "", is_default: true }] : (checked ? itemForm.sizes : []) })}
                    />
                  </div>
                  {!itemForm.has_sizes && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {SIZE_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setItemForm(prev => ({
                              ...prev,
                              has_sizes: true,
                              sizes: preset.sizes.map((name, idx) => ({
                                name,
                                price: "",
                                is_default: idx === 0,
                              })),
                            }));
                          }}
                        >
                          + {preset.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Single price OR sizes */}
                {!itemForm.has_sizes ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price ({currencySymbol}) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.price}
                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prep Time (mins)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={itemForm.preparation_time_minutes}
                        onChange={(e) => setItemForm({ ...itemForm, preparation_time_minutes: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Size Variants *</Label>
                    
                    {/* Size entries */}
                    <div className="space-y-2">
                      {itemForm.sizes.map((size, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={size.name}
                            onChange={(e) => updateSize(idx, "name", e.target.value)}
                            placeholder="Size name"
                            className="flex-1"
                          />
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={size.price}
                              onChange={(e) => updateSize(idx, "price", e.target.value)}
                              placeholder="0.00"
                              className="pl-6"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => removeSize(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSize}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Size
                      </Button>
                    </div>
                    
                    {/* Quick entry */}
                    {itemForm.sizes.length === 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs text-muted-foreground">Or paste sizes (one per line: Name: Price)</Label>
                        <Textarea
                          value={sizeQuickEntry}
                          onChange={(e) => setSizeQuickEntry(e.target.value)}
                          placeholder={"Small: 6.99\nMedium: 8.49\nLarge: 9.99"}
                          rows={3}
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={parseSizeQuickEntry}
                          disabled={!sizeQuickEntry.trim()}
                        >
                          Parse Sizes
                        </Button>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Prep Time (mins)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={itemForm.preparation_time_minutes}
                        onChange={(e) => setItemForm({ ...itemForm, preparation_time_minutes: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={itemForm.category_id || "none"}
                    onValueChange={(value) => setItemForm({ ...itemForm, category_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dietary Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {dietaryOptions.map((tag) => (
                      <Badge
                        key={tag}
                        variant={itemForm.dietary_tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleDietaryTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Available for ordering</Label>
                  <Switch
                    checked={itemForm.is_available}
                    onCheckedChange={(checked) => setItemForm({ ...itemForm, is_available: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveItem} disabled={savingItem}>
                  {savingItem && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingItem ? "Update" : "Add Item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {categories.length === 0 && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No menu items yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding categories and menu items
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => handleOpenCategoryDialog()}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
              <Button onClick={() => handleOpenItemDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories with items */}
      {categories.map((category) => {
        const categoryItems = items.filter(i => i.category_id === category.id);
        return (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenCategoryDialog(category)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(category.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {categoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No items in this category
                </p>
              ) : (
                <div className="space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {!item.is_available && (
                              <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                          )}
                          {item.dietary_tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {item.dietary_tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderPriceDisplay(item)}
                        <Button 
                          variant={item.hasOptions ? "secondary" : "outline"} 
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleOpenOptionsDialog(item)}
                        >
                          {item.hasOptions ? (
                            <>
                              <Settings2 className="w-3 h-3" />
                              {item.optionsSummary}
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              Add Choices
                            </>
                          )}
                        </Button>
                        <Switch
                          checked={item.is_available}
                          onCheckedChange={() => toggleItemAvailability(item)}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenItemDialog(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Uncategorized items */}
      {uncategorizedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">Uncategorized Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uncategorizedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {!item.is_available && (
                          <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderPriceDisplay(item)}
                    <Button 
                      variant={item.hasOptions ? "secondary" : "outline"} 
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleOpenOptionsDialog(item)}
                    >
                      {item.hasOptions ? (
                        <>
                          <Settings2 className="w-3 h-3" />
                          {item.optionsSummary}
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Add Choices
                        </>
                      )}
                    </Button>
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={() => toggleItemAvailability(item)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenItemDialog(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options Dialog */}
      {selectedItemForOptions && (
        <MenuItemOptionsDialog
          open={optionsDialogOpen}
          onOpenChange={setOptionsDialogOpen}
          menuItemId={selectedItemForOptions.id}
          menuItemName={selectedItemForOptions.name}
          currency={currency}
          onUpdate={loadMenu}
        />
      )}

      {/* Post-creation options prompt */}
      <Dialog open={showOptionsPrompt} onOpenChange={setShowOptionsPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add choices to "{newlyCreatedItem?.name}"?</DialogTitle>
            <DialogDescription>
              Does this item have customizable options like sizes, sides, or add-ons?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowOptionsPrompt(false);
                setNewlyCreatedItem(null);
              }}
              className="flex-1"
            >
              No, done
            </Button>
            <Button 
              onClick={() => {
                setShowOptionsPrompt(false);
                if (newlyCreatedItem) {
                  setSelectedItemForOptions(newlyCreatedItem);
                  setOptionsDialogOpen(true);
                }
                setNewlyCreatedItem(null);
              }}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Yes, add choices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};