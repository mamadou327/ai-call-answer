import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";

interface DepartmentsManagementProps {
  businessId: string;
  onUpdate?: () => void;
}

interface Department {
  id: string;
  name: string;
  phone_number: string | null;
  description: string | null;
  is_active: boolean;
  handles_bookings: boolean;
}

const SEEDS = ["Sales", "Service", "Parts", "Finance"];

const emptyForm = { name: "", phone_number: "", description: "", is_active: true, handles_bookings: false };

export const DepartmentsManagement = ({ businessId, onUpdate }: DepartmentsManagementProps) => {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("dealership_departments")
      .select("*")
      .eq("business_id", businessId)
      .order("name");
    if (error) toast({ title: "Failed to load departments", description: error.message, variant: "destructive" });
    else setDepartments((data || []) as Department[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({
      name: d.name,
      phone_number: d.phone_number || "",
      description: d.description || "",
      is_active: d.is_active,
      handles_bookings: d.handles_bookings,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Department name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      phone_number: form.phone_number.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
      handles_bookings: form.handles_bookings,
    };
    const { error } = editing
      ? await supabase.from("dealership_departments").update(payload).eq("id", editing.id)
      : await supabase.from("dealership_departments").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Department updated" : "Department added" });
    setDialogOpen(false);
    load();
    onUpdate?.();
  };

  const quickAdd = async (name: string) => {
    const { error } = await supabase.from("dealership_departments").insert({
      business_id: businessId,
      name,
      is_active: true,
      handles_bookings: name === "Service",
    });
    if (error) toast({ title: "Could not add department", description: error.message, variant: "destructive" });
    else { toast({ title: `${name} added` }); load(); onUpdate?.(); }
  };

  const toggleField = async (d: Department, field: "is_active" | "handles_bookings", value: boolean) => {
    setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, [field]: value } : x)));
    const { error } = await supabase.from("dealership_departments").update({ [field]: value }).eq("id", d.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); load(); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("dealership_departments").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Department deleted" }); load(); onUpdate?.(); }
    setDeleteTarget(null);
  };

  const missingSeeds = SEEDS.filter((s) => !departments.some((d) => d.name.toLowerCase() === s.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5" /> Departments
        </CardTitle>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Department
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {missingSeeds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Quick add:</span>
            {missingSeeds.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => quickAdd(s)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {s}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading departments...</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No departments yet — add the ones your AI receptionist should transfer calls to.
          </p>
        ) : (
          <div className="space-y-2">
            {departments.map((d) => (
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[d.phone_number, d.description].filter(Boolean).join(" · ") || "No phone number set"}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_active} onCheckedChange={(v) => toggleField(d, "is_active", v)} />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.handles_bookings} onCheckedChange={(v) => toggleField(d, "handles_bookings", v)} />
                    <span className="text-xs text-muted-foreground">Bookings</span>
                  </div>
                  <div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "Add department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sales" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+44..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Handles bookings</Label>
              <Switch checked={form.handles_bookings} onCheckedChange={(v) => setForm({ ...form, handles_bookings: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be removed and calls will no longer be transferred to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
