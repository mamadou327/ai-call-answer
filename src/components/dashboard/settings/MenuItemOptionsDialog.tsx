import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Loader2, GripVertical, ListPlus, Settings2 } from "lucide-react";
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

// Preset selection types for simplified UX
const SELECTION_PRESETS = [
  { label: "Pick exactly 1", min: 1, max: 1, required: true },
  { label: "Pick up to 1 (optional)", min: 0, max: 1, required: false },
  { label: "Pick up to 3", min: 0, max: 3, required: false },
  { label: "Pick as many as they want", min: 0, max: 10, required: false },
];

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
    selectionPreset: "0", // index into SELECTION_PRESETS
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

  // Quick entry mode
  const [quickEntryMode, setQuickEntryMode] = useState(false);
  const [quickEntryGroupId, setQuickEntryGroupId] = useState<string | null>(null);
  const [quickEntryText, setQuickEntryText] = useState("");
  const [savingQuickEntry, setSavingQuickEntry] = useState(false);

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
      // Find matching preset or default to custom
      const presetIndex = SELECTION_PRESETS.findIndex(
        p => p.min === group.min_selections && p.max === group.max_selections && p.required === group.is_required
      );
      setGroupForm({
        name: group.name,
        description: group.description || "",
        selectionPreset: presetIndex >= 0 ? presetIndex.toString() : "0",
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: "",
        description: "",
        selectionPreset: "0", // "Pick exactly 1"
      });
    }
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Error", description: "Choice name is required", variant: "destructive" });
      return;
    }

    const preset = SELECTION_PRESETS[parseInt(groupForm.selectionPreset)] || SELECTION_PRESETS[0];

    setSavingGroup(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("menu_item_option_groups")
          .update({
            name: groupForm.name.trim(),
            description: groupForm.description.trim() || null,
            is_required: preset.required,
            min_selections: preset.min,
            max_selections: preset.max,
          })
          .eq("id", editingGroup.id);
        if (error) throw error;
        toast({ title: "Choice updated" });
      } else {
        const { error } = await supabase
          .from("menu_item_option_groups")
          .insert({
            menu_item_id: menuItemId,
            name: groupForm.name.trim(),
            description: groupForm.description.trim() || null,
            is_required: preset.required,
            min_selections: preset.min,
            max_selections: preset.max,
            display_order: optionGroups.length,
          });
        if (error) throw error;
        toast({ title: "Choice created" });
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
    if (!confirm("Delete this choice and all its options?")) return;
    
    try {
      const { error } = await supabase
        .from("menu_item_option_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
      toast({ title: "Choice deleted" });
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Quick entry handler - parse text and create multiple options at once
  const handleQuickEntrySave = async () => {
    if (!quickEntryGroupId || !quickEntryText.trim()) return;

    const lines = quickEntryText.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      toast({ title: "Error", description: "Enter at least one option", variant: "destructive" });
      return;
    }

    setSavingQuickEntry(true);
    try {
      const existingOptions = options.filter(o => o.option_group_id === quickEntryGroupId);
      const optionsToInsert = lines.map((line, index) => {
        // Parse format: "Name" or "Name, +1.50" or "Name, -0.50"
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        let priceAdjustment = 0;
        
        if (parts[1]) {
          const priceStr = parts[1].replace(/[^0-9.-]/g, '');
          priceAdjustment = parseFloat(priceStr) || 0;
          if (parts[1].includes('-')) {
            priceAdjustment = -Math.abs(priceAdjustment);
          }
        }

        return {
          option_group_id: quickEntryGroupId,
          name: name,
          price_adjustment: priceAdjustment,
          is_default: false,
          is_available: true,
          display_order: existingOptions.length + index,
        };
      });

      const { error } = await supabase
        .from("menu_item_options")
        .insert(optionsToInsert);
      if (error) throw error;

      toast({ title: `Added ${optionsToInsert.length} options` });
      setQuickEntryMode(false);
      setQuickEntryText("");
      setQuickEntryGroupId(null);
      loadOptionsData();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving options:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingQuickEntry(false);
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
              Choices for "{menuItemName}"
            </DialogTitle>
            <DialogDescription>
              Add customization options like sizes, sides, or add-ons
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
                Add Choice
              </Button>

              {optionGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No choices yet.</p>
                  <p className="text-sm">Add choices like "Size" or "Choose Your Side"</p>
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
                            <div className="flex gap-1 mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => handleOpenOptionDialog(group.id)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add One
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => {
                                  setQuickEntryGroupId(group.id);
                                  setQuickEntryMode(true);
                                }}
                              >
                                <ListPlus className="w-3 h-3 mr-1" />
                                Bulk Add
                              </Button>
                            </div>
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
            <DialogTitle>{editingGroup ? "Edit Choice" : "Add Choice"}</DialogTitle>
            <DialogDescription>
              A choice lets customers customize their order (e.g., "Size", "Choose Your Side")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Choice Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Size, Choose Your Side, Add-ons"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Optional helper text for customers"
              />
            </div>
            <div className="space-y-2">
              <Label>How many can they pick?</Label>
              <Select
                value={groupForm.selectionPreset}
                onValueChange={(value) => setGroupForm({ ...groupForm, selectionPreset: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTION_PRESETS.map((preset, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Quick Entry Dialog */}
      <Dialog open={quickEntryMode} onOpenChange={setQuickEntryMode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Options</DialogTitle>
            <DialogDescription>
              Add multiple options at once. Enter one per line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Options (one per line)</Label>
              <Textarea
                value={quickEntryText}
                onChange={(e) => setQuickEntryText(e.target.value)}
                placeholder={`Fries\nColeslaw\nRice, +0.50\nOnion Rings, +1.00\nSmall, -1.00`}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Format: Name or Name, +price (e.g., "Large, +1.50" or "Small, -0.50")
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setQuickEntryMode(false);
              setQuickEntryText("");
            }}>Cancel</Button>
            <Button onClick={handleQuickEntrySave} disabled={savingQuickEntry || !quickEntryText.trim()}>
              {savingQuickEntry && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add All
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
