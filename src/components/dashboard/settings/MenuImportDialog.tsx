import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Upload, Sparkles, FileText, AlertCircle, File, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedOption {
  name: string;
  price_adjustment: number;
  dietary_tags: string[];
}

interface ParsedOptionGroup {
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  options: ParsedOption[];
}

interface ParsedMenuItem {
  name: string;
  description: string | null;
  price: number;
  category_name: string;
  dietary_tags: string[];
  has_sizes: boolean;
  sizes: Array<{ name: string; price: number }>;
  option_groups: ParsedOptionGroup[];
  selected: boolean;
}

interface ParsedCategory {
  name: string;
  description: string | null;
}

interface MenuImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  currency?: string;
  existingCategories: Array<{ id: string; name: string }>;
  onImportComplete: () => void;
}

export const MenuImportDialog = ({
  open,
  onOpenChange,
  businessId,
  currency = "GBP",
  existingCategories,
  onImportComplete,
}: MenuImportDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [menuText, setMenuText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [parsedCategories, setParsedCategories] = useState<ParsedCategory[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

  const resetState = () => {
    setMenuText("");
    setSelectedFile(null);
    setFilePreview(null);
    setFileType(null);
    setAnalyzing(false);
    setImporting(false);
    setError(null);
    setParsedCategories([]);
    setParsedItems([]);
    setShowPreview(false);
    setActiveTab("text");
    setExpandedItems(new Set());
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isPdf) {
      toast({ title: "Error", description: "Please select an image or PDF file", variant: "destructive" });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be under 15MB", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    setFileType(isPdf ? "pdf" : "image");
    
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      let payload: { menuText?: string; menuImage?: string; menuPdf?: string; currency: string } = { currency };

      if (activeTab === "text") {
        if (!menuText.trim()) {
          throw new Error("Please paste your menu text first");
        }
        payload.menuText = menuText;
      } else {
        if (!filePreview) {
          throw new Error("Please upload a menu file first");
        }
        if (fileType === "pdf") {
          payload.menuPdf = filePreview;
        } else {
          payload.menuImage = filePreview;
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke("parse-menu", {
        body: payload,
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      const itemsWithSelection = data.items.map((item: any) => ({
        ...item,
        option_groups: item.option_groups || [],
        selected: true,
      }));

      setParsedCategories(data.categories || []);
      setParsedItems(itemsWithSelection);
      setShowPreview(true);

      // Count option groups for the toast
      const totalOptionGroups = itemsWithSelection.reduce((acc: number, item: ParsedMenuItem) => 
        acc + (item.option_groups?.length || 0), 0);

      toast({
        title: "Menu analyzed!",
        description: `Found ${data.items.length} items in ${data.categories.length} categories${totalOptionGroups > 0 ? `, ${totalOptionGroups} option groups` : ""}`,
      });
    } catch (err: any) {
      console.error("Analyze error:", err);
      setError(err.message || "Failed to analyze menu");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setParsedItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleAllItems = (selected: boolean) => {
    setParsedItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleImport = async () => {
    const selectedItems = parsedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to import", variant: "destructive" });
      return;
    }

    setImporting(true);

    try {
      // Build a map of existing categories (case-insensitive)
      const existingCategoryMap = new Map<string, string>();
      existingCategories.forEach(cat => {
        existingCategoryMap.set(cat.name.toLowerCase(), cat.id);
      });

      // Determine which categories need to be created
      const categoriesToCreate: string[] = [];
      const categoryNamesUsed = new Set<string>();
      
      selectedItems.forEach(item => {
        const lowerName = item.category_name.toLowerCase();
        if (!existingCategoryMap.has(lowerName) && !categoryNamesUsed.has(lowerName)) {
          categoriesToCreate.push(item.category_name);
          categoryNamesUsed.add(lowerName);
        }
      });

      // Create new categories
      if (categoriesToCreate.length > 0) {
        const { data: newCats, error: catError } = await supabase
          .from("menu_categories")
          .insert(
            categoriesToCreate.map((name, idx) => ({
              business_id: businessId,
              name,
              display_order: existingCategories.length + idx,
            }))
          )
          .select();

        if (catError) throw catError;

        newCats?.forEach(cat => {
          existingCategoryMap.set(cat.name.toLowerCase(), cat.id);
        });
      }

      // Insert menu items
      const itemsToInsert = selectedItems.map((item, idx) => ({
        business_id: businessId,
        name: item.name,
        description: item.description,
        price: item.price,
        category_id: existingCategoryMap.get(item.category_name.toLowerCase()) || null,
        dietary_tags: item.dietary_tags,
        has_sizes: item.has_sizes,
        is_available: true,
        display_order: idx,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("menu_items")
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;

      // Insert sizes for items that have them
      const sizesToInsert: Array<{
        menu_item_id: string;
        name: string;
        price: number;
        is_default: boolean;
        display_order: number;
      }> = [];

      insertedItems?.forEach((dbItem, idx) => {
        const sourceItem = selectedItems[idx];
        if (sourceItem.has_sizes && sourceItem.sizes.length > 0) {
          sourceItem.sizes.forEach((size, sizeIdx) => {
            sizesToInsert.push({
              menu_item_id: dbItem.id,
              name: size.name,
              price: size.price,
              is_default: sizeIdx === 0,
              display_order: sizeIdx,
            });
          });
        }
      });

      if (sizesToInsert.length > 0) {
        const { error: sizesError } = await supabase
          .from("menu_item_sizes")
          .insert(sizesToInsert);

        if (sizesError) throw sizesError;
      }

      // Insert option groups and options
      let totalOptionGroupsCreated = 0;
      let totalOptionsCreated = 0;

      for (let idx = 0; idx < (insertedItems?.length || 0); idx++) {
        const dbItem = insertedItems![idx];
        const sourceItem = selectedItems[idx];

        if (sourceItem.option_groups && sourceItem.option_groups.length > 0) {
          for (let ogIdx = 0; ogIdx < sourceItem.option_groups.length; ogIdx++) {
            const og = sourceItem.option_groups[ogIdx];

            // Insert the option group
            const { data: insertedGroup, error: ogError } = await supabase
              .from("menu_item_option_groups")
              .insert({
                menu_item_id: dbItem.id,
                name: og.name,
                is_required: og.is_required,
                min_selections: og.min_selections,
                max_selections: og.max_selections,
                display_order: ogIdx,
              })
              .select()
              .single();

            if (ogError) throw ogError;
            totalOptionGroupsCreated++;

            // Insert options for this group
            if (og.options && og.options.length > 0) {
              const optionsToInsert = og.options.map((opt, optIdx) => ({
                option_group_id: insertedGroup.id,
                name: opt.name,
                price_adjustment: opt.price_adjustment,
                is_default: optIdx === 0 && og.is_required,
                display_order: optIdx,
              }));

              const { error: optError } = await supabase
                .from("menu_item_options")
                .insert(optionsToInsert);

              if (optError) throw optError;
              totalOptionsCreated += optionsToInsert.length;
            }
          }
        }
      }

      const optionMessage = totalOptionGroupsCreated > 0 
        ? `, ${totalOptionGroupsCreated} option groups, ${totalOptionsCreated} options`
        : "";

      toast({
        title: "Import complete!",
        description: `Added ${selectedItems.length} items${optionMessage} to your menu`,
      });

      handleClose();
      onImportComplete();
    } catch (err: any) {
      console.error("Import error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedItems.filter(i => i.selected).length;
  const totalOptionGroups = parsedItems.reduce((acc, item) => acc + (item.option_groups?.length || 0), 0);

  const formatSelectionRule = (og: ParsedOptionGroup) => {
    if (og.is_required && og.min_selections === 1 && og.max_selections === 1) {
      return "pick 1";
    }
    if (!og.is_required && og.max_selections >= 10) {
      return "optional";
    }
    if (og.max_selections > 1) {
      return `up to ${og.max_selections}`;
    }
    return og.is_required ? "required" : "optional";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import Menu with AI
          </DialogTitle>
          <DialogDescription>
            Paste your menu text or upload a photo, and AI will extract all items including customization options.
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "file")} className="flex-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="flex-1 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="menu-text">Menu Text</Label>
                  <Textarea
                    id="menu-text"
                    value={menuText}
                    onChange={(e) => setMenuText(e.target.value)}
                    placeholder={`Paste your menu here...\n\nExample:\nBurrito Bowl - ${currencySymbol}8.99\nBuild your own bowl\n\nChoose your protein (pick 1):\n- Chicken\n- Beef (+${currencySymbol}1.50)\n- Carnitas (+${currencySymbol}2)\n\nAdd extras (optional):\n- Guacamole (+${currencySymbol}2)\n- Sour Cream (+${currencySymbol}0.50)`}
                    className="min-h-[250px] font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="file" className="flex-1 mt-4">
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {!filePreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload a menu photo or PDF
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, PDF up to 15MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fileType === "pdf" ? (
                        <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                          <File className="h-10 w-10 text-primary" />
                          <div>
                            <p className="font-medium">{selectedFile?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedFile && (selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={filePreview}
                          alt="Menu preview"
                          className="max-h-[250px] mx-auto rounded-lg border"
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                          setFileType(null);
                        }}
                      >
                        Remove File
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || (activeTab === "text" ? !menuText.trim() : !filePreview)}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Menu
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                Found {parsedItems.length} items in {parsedCategories.length} categories
                {totalOptionGroups > 0 && `, ${totalOptionGroups} option groups`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllItems(true)}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllItems(false)}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => {
                    const hasOptions = item.option_groups && item.option_groups.length > 0;
                    const isExpanded = expandedItems.has(index);

                    return (
                      <Collapsible key={index} open={isExpanded} asChild>
                        <>
                          <TableRow className={!item.selected ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={() => toggleItemSelection(index)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                {hasOptions && (
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 shrink-0"
                                      onClick={() => toggleExpanded(index)}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {item.description}
                                    </p>
                                  )}
                                  {hasOptions && !isExpanded && (
                                    <p className="text-xs text-primary mt-1">
                                      {item.option_groups.length} option group{item.option_groups.length > 1 ? "s" : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.has_sizes && item.sizes.length > 0 ? (
                                <div className="text-xs">
                                  {item.sizes.map((s, i) => (
                                    <div key={i}>
                                      {s.name}: {currencySymbol}{s.price.toFixed(2)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>{currencySymbol}{item.price.toFixed(2)}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category_name}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.dietary_tags.map((tag, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {hasOptions && (
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={5} className="py-2 px-4">
                                  <div className="space-y-3 pl-8">
                                    {item.option_groups.map((og, ogIdx) => (
                                      <div key={ogIdx} className="text-sm">
                                        <div className="flex items-center gap-2 font-medium text-muted-foreground">
                                          <span>↳ {og.name}</span>
                                          <Badge variant="outline" className="text-xs font-normal">
                                            {formatSelectionRule(og)}
                                          </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1 ml-4">
                                          {og.options.map((opt, optIdx) => (
                                            <span key={optIdx} className="text-xs text-muted-foreground">
                                              {opt.name}
                                              {opt.price_adjustment > 0 && (
                                                <span className="text-primary ml-1">
                                                  +{currencySymbol}{opt.price_adjustment.toFixed(2)}
                                                </span>
                                              )}
                                              {opt.dietary_tags.length > 0 && (
                                                <span className="text-secondary-foreground ml-1">
                                                  ({opt.dietary_tags.join(", ")})
                                                </span>
                                              )}
                                              {optIdx < og.options.length - 1 && ","}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          )}
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedCount} Items`
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
