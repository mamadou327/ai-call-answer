import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Plus, Pencil, Trash2, Upload, Download, Search, ArrowUpDown } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils";

interface InventoryTabProps {
  businessId: string;
  currency?: string;
}

interface Vehicle {
  id: string;
  registration: string | null;
  vin: string | null;
  make: string;
  model: string;
  variant: string | null;
  year: number | null;
  colour: string | null;
  fuel_type: string | null;
  transmission: string | null;
  mileage: number | null;
  price: number | null;
  status: string;
  body_type: string | null;
  doors: number | null;
  engine_size: string | null;
  description: string | null;
}

const STATUSES = ["in_stock", "reserved", "sold", "incoming"] as const;
const FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric"];
const TRANSMISSIONS = ["manual", "automatic"];
const BODY_TYPES = ["hatchback", "saloon", "SUV", "estate", "coupe", "convertible", "van"];

const CSV_HEADERS = [
  "registration", "vin", "make", "model", "variant", "year", "colour",
  "fuel_type", "transmission", "mileage", "price", "status",
  "body_type", "doors", "engine_size", "description",
];

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const statusClass = (s: string) => {
  switch (s) {
    case "in_stock":
      return "bg-green-500/15 text-green-600 border-green-500/30";
    case "reserved":
      return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "sold":
      return "bg-muted text-muted-foreground border-border";
    case "incoming":
      return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    default:
      return "";
  }
};

const emptyForm = {
  registration: "", vin: "", make: "", model: "", variant: "", year: "", colour: "",
  fuel_type: "", transmission: "", mileage: "", price: "", status: "in_stock",
  body_type: "", doors: "", engine_size: "", description: "",
};

type FormState = typeof emptyForm;

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

export const InventoryTab = ({ businessId, currency = "GBP" }: InventoryTabProps) => {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "year" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const symbol = getCurrencySymbol(currency);

  const load = async () => {
    const { data, error } = await supabase
      .from("dealership_inventory")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load inventory", description: error.message, variant: "destructive" });
    } else {
      setVehicles((data || []) as Vehicle[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = vehicles;
    if (q) {
      list = list.filter((v) =>
        [v.make, v.model, v.variant, v.registration].some((f) => (f || "").toLowerCase().includes(q))
      );
    }
    if (sortBy) {
      list = [...list].sort((a, b) => {
        const av = (sortBy === "price" ? a.price : a.year) ?? -Infinity;
        const bv = (sortBy === "price" ? b.price : b.year) ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return list;
  }, [vehicles, search, sortBy, sortDir]);

  const stats = useMemo(() => {
    const inStock = vehicles.filter((v) => v.status === "in_stock");
    return {
      total: vehicles.length,
      inStock: inStock.length,
      reserved: vehicles.filter((v) => v.status === "reserved").length,
      value: inStock.reduce((sum, v) => sum + (Number(v.price) || 0), 0),
    };
  }, [vehicles]);

  const toggleSort = (col: "price" | "year") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      registration: v.registration || "", vin: v.vin || "", make: v.make, model: v.model,
      variant: v.variant || "", year: v.year?.toString() || "", colour: v.colour || "",
      fuel_type: v.fuel_type || "", transmission: v.transmission || "",
      mileage: v.mileage?.toString() || "", price: v.price?.toString() || "",
      status: v.status, body_type: v.body_type || "", doors: v.doors?.toString() || "",
      engine_size: v.engine_size || "", description: v.description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim()) {
      toast({ title: "Make and model are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      business_id: businessId,
      registration: form.registration.trim() || null,
      vin: form.vin.trim() || null,
      make: form.make.trim(),
      model: form.model.trim(),
      variant: form.variant.trim() || null,
      year: form.year ? parseInt(form.year, 10) : null,
      colour: form.colour.trim() || null,
      fuel_type: form.fuel_type || null,
      transmission: form.transmission || null,
      mileage: form.mileage ? parseInt(form.mileage, 10) : null,
      price: form.price ? Number(form.price) : null,
      status: form.status || "in_stock",
      body_type: form.body_type || null,
      doors: form.doors ? parseInt(form.doors, 10) : null,
      engine_size: form.engine_size.trim() || null,
      description: form.description.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("dealership_inventory").update(payload).eq("id", editing.id)
      : await supabase.from("dealership_inventory").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Vehicle updated" : "Vehicle added" });
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("dealership_inventory").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Vehicle deleted" }); load(); }
    setDeleteTarget(null);
  };

  const changeStatus = async (v: Vehicle, status: string) => {
    setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, status } : x)));
    const { error } = await supabase.from("dealership_inventory").update({ status }).eq("id", v.id);
    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      load();
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_HEADERS.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aivia-inventory-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text).filter((r) => (r.make || "").trim() && (r.model || "").trim());
    if (!rows.length) {
      toast({ title: "No valid rows found", description: "Each row needs at least a make and model.", variant: "destructive" });
      return;
    }
    setImportRows(rows);
  };

  const confirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    const payload = importRows.map((r) => ({
      business_id: businessId,
      registration: r.registration || null,
      vin: r.vin || null,
      make: r.make,
      model: r.model,
      variant: r.variant || null,
      year: r.year ? parseInt(r.year, 10) || null : null,
      colour: r.colour || null,
      fuel_type: r.fuel_type || null,
      transmission: r.transmission || null,
      mileage: r.mileage ? parseInt(r.mileage, 10) || null : null,
      price: r.price ? Number(r.price) || null : null,
      status: STATUSES.includes((r.status || "") as typeof STATUSES[number]) ? r.status : "in_stock",
      body_type: r.body_type || null,
      doors: r.doors ? parseInt(r.doors, 10) || null : null,
      engine_size: r.engine_size || null,
      description: r.description || null,
    }));
    const { error } = await supabase.from("dealership_inventory").insert(payload);
    setImporting(false);
    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Imported ${payload.length} vehicles` });
    setImportRows(null);
    load();
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total vehicles", value: stats.total },
          { label: "In stock", value: stats.inStock },
          { label: "Reserved", value: stats.reserved },
          { label: "Stock value", value: `${symbol}${stats.value.toLocaleString()}` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="w-5 h-5" /> Inventory
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search make, model, reg..."
                className="pl-8 w-full sm:w-56"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1.5" /> CSV Import
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1.5" /> Template
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading inventory...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vehicles yet. Add one or import a CSV.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("year")}>
                        Year <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2 pr-3 font-medium">Vehicle</th>
                    <th className="py-2 pr-3 font-medium hidden md:table-cell">Colour</th>
                    <th className="py-2 pr-3 font-medium hidden md:table-cell">Mileage</th>
                    <th className="py-2 pr-3 font-medium hidden lg:table-cell">Fuel</th>
                    <th className="py-2 pr-3 font-medium hidden lg:table-cell">Transmission</th>
                    <th className="py-2 pr-3 font-medium">
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("price")}>
                        Price <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-3">{v.year ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{v.make} {v.model}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.variant, v.registration].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="py-2 pr-3 hidden md:table-cell">{v.colour || "—"}</td>
                      <td className="py-2 pr-3 hidden md:table-cell">{v.mileage != null ? v.mileage.toLocaleString() : "—"}</td>
                      <td className="py-2 pr-3 hidden lg:table-cell capitalize">{v.fuel_type || "—"}</td>
                      <td className="py-2 pr-3 hidden lg:table-cell capitalize">{v.transmission || "—"}</td>
                      <td className="py-2 pr-3">{v.price != null ? `${symbol}${Number(v.price).toLocaleString()}` : "—"}</td>
                      <td className="py-2 pr-3">
                        <Select value={v.status} onValueChange={(val) => changeStatus(v, val)}>
                          <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent px-0 focus:ring-0">
                            <Badge variant="outline" className={statusClass(v.status)}>
                              {statusLabel(v.status)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(v)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Registration</Label>
              <Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>VIN</Label>
              <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Make *</Label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Variant</Label>
              <Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Input value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fuel type</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Transmission</Label>
              <Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {TRANSMISSIONS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mileage</Label>
              <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price ({symbol})</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Body type</Label>
              <Select value={form.body_type} onValueChange={(v) => setForm({ ...form, body_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BODY_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Doors</Label>
              <Input type="number" value={form.doors} onChange={(e) => setForm({ ...form, doors: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Engine size</Label>
              <Input value={form.engine_size} onChange={(e) => setForm({ ...form, engine_size: e.target.value })} placeholder="e.g. 1.6" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV preview */}
      <Dialog open={!!importRows} onOpenChange={(o) => !o && setImportRows(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>
              {importRows?.length ?? 0} vehicles ready to import.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Make</th><th className="p-2">Model</th><th className="p-2">Variant</th>
                  <th className="p-2">Year</th><th className="p-2">Price</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(importRows || []).slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.make}</td>
                    <td className="p-2">{r.model}</td>
                    <td className="p-2">{r.variant || "—"}</td>
                    <td className="p-2">{r.year || "—"}</td>
                    <td className="p-2">{r.price || "—"}</td>
                    <td className="p-2">{r.status || "in_stock"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(importRows?.length || 0) > 50 && (
            <p className="text-xs text-muted-foreground">Showing first 50 rows.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportRows(null)}>Cancel</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${importRows?.length ?? 0} vehicles`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.make} ${deleteTarget.model}` : ""} will be permanently removed from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
