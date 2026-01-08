import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Loader2, GripVertical, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OptionGroup {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  display_order: number;
}

interface Option {
  id: string;
  option_group_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
}

interface MenuItemOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItemId: string;
  menuItemName: string;
  currency: string;
  onUpdate?: () => void;
}

export const MenuItemOptionsDialog = ({
  open,
  onOpenChange,
  menuItemId,
  menuItemName,
  currency,
  onUpdate,
}: MenuItemOptionsDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  
  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    is_required: false,
    min_selections: 0,
    max_selections: 1,
  });
  const [savingGroup, setSavingGroup] = useState(false);
  
  // Option dialog state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [optionForm, setOptionForm] = useState({
    name: "",
    price_adjustment: "0",
    is_default: false,
    is_available: true,
  });
  const [savingOption, setSavingOption] = useState(false);

  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

  useEffect(() => {
    if (open && menuItemId) {
      loadOptionsData();
    }
  }, [open, menuItemId]);

  const loadOptionsData = async () => {
    setLoading(true);
    try {
      const [groupsRes, optionsRes] = await Promise.all([
        supabase
          .from("menu_item_option_groups")
          .select("*")
          .eq("menu_item_id", menuItemId)
          .order("display_order"),
        supabase
          .from("menu_item_options")
          .select("*")
          .in("option_group_id", 
            (await supabase
              .from("menu_item_option_groups")
              .select("id")
              .eq("menu_item_id", menuItemId)
            ).data?.map(g => g.id) || []
          )
          .order("display_order"),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      setOptionGroups(groupsRes.data || []);
      setOptions(optionsRes.data || []);
    } catch (error: any) {
      console.error("Error loading options:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group handlers
  const handleOpenGroupDialog = (group?: OptionGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        description: group.description || "",
        is_required: group.is_required,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: "",
        description: "",
        is_required: false,
        min_selections: 0,
        max_selections: 1,
      });
    }
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Error", description: "Group name is required", variant: "destructive" });
      return;
    }

    setSavingGroup(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("menu_item_option_groups")
          .update({
            name: groupForm.name.trim(),
            description: groupForm.description.trim() || null,
            is_required: groupForm.is_required,
            min_selections: groupForm.min_selections,
            max_selections: groupForm.max_selections,
          })
          .eq("id", editingGroup.id);
        if (error) throw error;
        toast({ title: "Option group updated" });
      } else {
        const { error } = await supabase
          .from("menu_item_option_groups")
          .insert({
            menu_item_id: menuItemId,
            name: groupForm.name.trim(),
            description: groupForm.description.trim() || null,
            is_required: groupForm.is_required,
            min_selections: groupForm.min_selections,
            max_selections: groupForm.max_selections,
            display_order: optionGroups.length,
          });
        if (error) throw error;
        toast({ title: "Option group created" });
      }
      setGroupDialogOpen(false);
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving group:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this option group and all its options?")) return;
    
    try {
      const { error } = await supabase
        .from("menu_item_option_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
      toast({ title: "Option group deleted" });
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Option handlers
  const handleOpenOptionDialog = (groupId: string, option?: Option) => {
    setSelectedGroupId(groupId);
    if (option) {
      setEditingOption(option);
      setOptionForm({
        name: option.name,
        price_adjustment: option.price_adjustment.toString(),
        is_default: option.is_default,
        is_available: option.is_available,
      });
    } else {
      setEditingOption(null);
      setOptionForm({
        name: "",
        price_adjustment: "0",
        is_default: false,
        is_available: true,
      });
    }
    setOptionDialogOpen(true);
  };

  const handleSaveOption = async () => {
    if (!optionForm.name.trim() || !selectedGroupId) {
      toast({ title: "Error", description: "Option name is required", variant: "destructive" });
      return;
    }

    setSavingOption(true);
    try {
      const groupOptions = options.filter(o => o.option_group_id === selectedGroupId);
      
      if (editingOption) {
        const { error } = await supabase
          .from("menu_item_options")
          .update({
            name: optionForm.name.trim(),
            price_adjustment: parseFloat(optionForm.price_adjustment) || 0,
            is_default: optionForm.is_default,
            is_available: optionForm.is_available,
          })
          .eq("id", editingOption.id);
        if (error) throw error;
        toast({ title: "Option updated" });
      } else {
        const { error } = await supabase
          .from("menu_item_options")
          .insert({
            option_group_id: selectedGroupId,
            name: optionForm.name.trim(),
            price_adjustment: parseFloat(optionForm.price_adjustment) || 0,
            is_default: optionForm.is_default,
            is_available: optionForm.is_available,
            display_order: groupOptions.length,
          });
        if (error) throw error;
        toast({ title: "Option added" });
      }
      setOptionDialogOpen(false);
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving option:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingOption(false);
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    if (!confirm("Delete this option?")) return;
    
    try {
      const { error } = await supabase
        .from("menu_item_options")
        .delete()
        .eq("id", optionId);
      if (error) throw error;
      toast({ title: "Option deleted" });
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting option:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleOptionAvailability = async (option: Option) => {
    try {
      const { error } = await supabase
        .from("menu_item_options")
        .update({ is_available: !option.is_available })
        .eq("id", option.id);
      if (error) throw error;
      loadOptionsData();
    } catch (error: any) {
      console.error("Error toggling option:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const formatPriceAdjustment = (amount: number) => {
    if (amount === 0) return "";
    return amount > 0 ? `+${currencySymbol}${amount.toFixed(2)}` : `-${currencySymbol}${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Options for "{menuItemName}"
            </DialogTitle>
            <DialogDescription>
              Configure variations like sizes, sides, or add-ons for this item
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <Button variant="outline" size="sm" onClick={() => handleOpenGroupDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Option Group
              </Button>

              {optionGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No option groups yet.</p>
                  <p className="text-sm">Add groups like "Size" or "Choose Your Side"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {optionGroups.map((group) => {
                    const groupOptions = options.filter(o => o.option_group_id === group.id);
                    return (
                      <Card key={group.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm font-medium">{group.name}</CardTitle>
                              {group.is_required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                              {group.max_selections > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  Select {group.min_selections}-{group.max_selections}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenGroupDialog(group)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteGroup(group.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <div className="space-y-1">
                            {groupOptions.map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                                  <span className={!option.is_available ? "text-muted-foreground line-through" : ""}>
                                    {option.name}
                                  </span>
                                  {option.is_default && (
                                    <Badge variant="secondary" className="text-xs py-0">Default</Badge>
                                  )}
                                  {option.price_adjustment !== 0 && (
                                    <span className={option.price_adjustment > 0 ? "text-amber-600 text-xs" : "text-green-600 text-xs"}>
                                      {formatPriceAdjustment(option.price_adjustment)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Switch
                                    checked={option.is_available}
                                    onCheckedChange={() => toggleOptionAvailability(option)}
                                    className="scale-75"
                                  />
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenOptionDialog(group.id, option)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteOption(option.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-8 text-xs mt-1"
                              onClick={() => handleOpenOptionDialog(group.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Option
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Option Group" : "Add Option Group"}</DialogTitle>
            <DialogDescription>
              Groups organize related options (e.g., "Size", "Choose Your Side")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Size, Choose Your Side, Add-ons"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Optional helper text"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Required Selection</Label>
                <p className="text-xs text-muted-foreground">Customer must choose from this group</p>
              </div>
              <Switch
                checked={groupForm.is_required}
                onCheckedChange={(checked) => setGroupForm({ ...groupForm, is_required: checked })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Selections</Label>
                <Input
                  type="number"
                  min="0"
                  value={groupForm.min_selections}
                  onChange={(e) => setGroupForm({ ...groupForm, min_selections: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Selections</Label>
                <Input
                  type="number"
                  min="1"
                  value={groupForm.max_selections}
                  onChange={(e) => setGroupForm({ ...groupForm, max_selections: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={savingGroup}>
              {savingGroup && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOption ? "Edit Option" : "Add Option"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Option Name *</Label>
              <Input
                value={optionForm.name}
                onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                placeholder="e.g., Large, Rice, Extra Cheese"
              />
            </div>
            <div className="space-y-2">
              <Label>Price Adjustment ({currencySymbol})</Label>
              <Input
                type="number"
                step="0.01"
                value={optionForm.price_adjustment}
                onChange={(e) => setOptionForm({ ...optionForm, price_adjustment: e.target.value })}
                placeholder="0 for no change, negative to reduce price"
              />
              <p className="text-xs text-muted-foreground">
                Use 0 for included options, positive for add-ons, negative for smaller sizes
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Default Option</Label>
              <Switch
                checked={optionForm.is_default}
                onCheckedChange={(checked) => setOptionForm({ ...optionForm, is_default: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Available</Label>
              <Switch
                checked={optionForm.is_available}
                onCheckedChange={(checked) => setOptionForm({ ...optionForm, is_available: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOption} disabled={savingOption}>
              {savingOption && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingOption ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
