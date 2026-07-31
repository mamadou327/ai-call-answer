import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Phone, UserPlus } from "lucide-react";
import { format } from "date-fns";

interface LeadsTabProps {
  businessId: string;
}

interface Lead {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  lead_type: string;
  interested_in: string | null;
  budget: string | null;
  has_trade_in: boolean | null;
  trade_in_details: string | null;
  timeframe: string | null;
  lead_score: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "sales", label: "Sales" },
  { key: "service", label: "Service" },
  { key: "parts", label: "Parts" },
];

const STATUSES = ["new", "contacted", "appointment_booked", "won", "lost"];

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const scoreClass = (score: string) => {
  switch (score) {
    case "hot":
      return "bg-red-500/15 text-red-600 border-red-500/30";
    case "warm":
      return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    default:
      return "bg-blue-500/15 text-blue-600 border-blue-500/30";
  }
};

export const LeadsTab = ({ businessId }: LeadsTabProps) => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("dealership_leads")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load leads", description: error.message, variant: "destructive" });
    } else {
      setLeads((data || []) as Lead[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dealership-leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dealership_leads", filter: `business_id=eq.${businessId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "hot": return leads.filter((l) => l.lead_score === "hot");
      case "new": return leads.filter((l) => l.status === "new");
      case "sales":
      case "service":
      case "parts":
        return leads.filter((l) => l.lead_type === filter);
      default: return leads;
    }
  }, [leads, filter]);

  const stats = useMemo(() => ({
    total: leads.length,
    hot: leads.filter((l) => l.lead_score === "hot").length,
    newLeads: leads.filter((l) => l.status === "new").length,
    won: leads.filter((l) => l.status === "won").length,
  }), [leads]);

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setNotes(lead.notes || "");
  };

  const updateLead = async (patch: Partial<Lead>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("dealership_leads").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setSelected({ ...selected, ...patch } as Lead);
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...patch } as Lead : l)));
    toast({ title: "Lead updated" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total leads", value: stats.total },
          { label: "Hot leads", value: stats.hot },
          { label: "New", value: stats.newLeads },
          { label: "Won", value: stats.won },
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
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5" /> Leads
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.key === "hot" && <Flame className="w-3.5 h-3.5 mr-1" />}
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading leads...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No leads to show yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => openLead(lead)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{lead.customer_name || "Unknown caller"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[lead.customer_phone, lead.interested_in].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">{lead.lead_type}</Badge>
                    <Badge variant="outline" className={`text-[10px] sm:text-xs ${scoreClass(lead.lead_score)}`}>
                      {pretty(lead.lead_score)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">{pretty(lead.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.customer_name || "Lead details"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Phone</p><p>{selected.customer_phone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Email</p><p className="truncate">{selected.customer_email || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Type</p><p className="capitalize">{selected.lead_type}</p></div>
                <div><p className="text-muted-foreground text-xs">Score</p><p>{pretty(selected.lead_score)}</p></div>
                <div><p className="text-muted-foreground text-xs">Interested in</p><p>{selected.interested_in || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Budget</p><p>{selected.budget || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Trade-in</p><p>{selected.has_trade_in ? (selected.trade_in_details || "Yes") : "No"}</p></div>
                <div><p className="text-muted-foreground text-xs">Timeframe</p><p>{selected.timeframe || "—"}</p></div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p>{format(new Date(selected.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={selected.status} onValueChange={(v) => updateLead({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{pretty(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button size="sm" onClick={() => updateLead({ notes })} disabled={saving}>
                  {saving ? "Saving..." : "Save notes"}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selected?.customer_phone && (
              <Button asChild variant="outline">
                <a href={`tel:${selected.customer_phone}`}>
                  <Phone className="w-4 h-4 mr-1.5" /> Call
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
