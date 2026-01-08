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
import { Plus, Pencil, Trash2, UtensilsCrossed, FolderPlus, Loader2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

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
  });
  const [savingItem, setSavingItem] = useState(false);

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

      setCategories(categoriesRes.data || []);
      setItems(itemsRes.data || []);
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
      setItemForm({
        name: item.name,
        description: item.description || "",
        price: item.price.toString(),
        category_id: item.category_id || "",
        preparation_time_minutes: item.preparation_time_minutes.toString(),
        dietary_tags: item.dietary_tags || [],
        is_available: item.is_available,
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
      });
    }
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.price) {
      toast({ title: "Error", description: "Name and price are required", variant: "destructive" });
      return;
    }

    setSavingItem(true);
    try {
      const itemData = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        price: parseFloat(itemForm.price),
        category_id: itemForm.category_id || null,
        preparation_time_minutes: parseInt(itemForm.preparation_time_minutes) || 15,
        dietary_tags: itemForm.dietary_tags,
        is_available: itemForm.is_available,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(itemData)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Item updated" });
      } else {
        const { error } = await supabase
          .from("menu_items")
          .insert({
            ...itemData,
            business_id: businessId,
            display_order: items.length,
          });
        if (error) throw error;
        toast({ title: "Item added" });
      }
      setItemDialogOpen(false);
      loadMenu();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving item:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingItem(false);
    }
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
              <Button size="sm" onClick={() => handleOpenItemDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
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
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={itemForm.category_id}
                    onValueChange={(value) => setItemForm({ ...itemForm, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Uncategorized</SelectItem>
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
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{currencySymbol}{item.price.toFixed(2)}</span>
                        <Switch
                          checked={item.is_available}
                          onCheckedChange={() => toggleItemAvailability(item)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleOpenItemDialog(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
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
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{currencySymbol}{item.price.toFixed(2)}</span>
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={() => toggleItemAvailability(item)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleOpenItemDialog(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};