import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Pause, Square, ChevronLeft, Upload, Plus, FileText, Save, Trash2 } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BUSINESS_TYPES = ["salon","barbershop","restaurant","spa","clinic","trades","estate_agent","beauty","other"] as const;
const businessTypeLabel = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

type Campaign = {
  id: string; name: string; status: "draft" | "active" | "paused" | "completed";
  calling_days: string[]; calling_start_hour: number; calling_end_hour: number;
  calls_per_day_limit: number; delay_between_calls_seconds: number;
  voice: string;
  created_at: string;
};
type Lead = {
  id: string; campaign_id: string; first_name: string | null; business_name: string | null;
  phone_number: string; email: string | null;
  status: string; interest_level: string | null; existing_solution: string | null;
  reason_not_interested: string | null; demo_booked: boolean;
  call_duration_seconds: number | null; call_recording_url: string | null;
  call_transcript: string | null; last_called_at: string | null; created_at: string;
  sms_sent: boolean;
  business_type: string | null;
  email1_status?: string | null; email1_sent_at?: string | null; email1_opened_at?: string | null;
  email2_status?: string | null; email2_sent_at?: string | null; email2_opened_at?: string | null;
  email3_status?: string | null; email3_sent_at?: string | null; email3_opened_at?: string | null;
  sequence_status?: string | null; sequence_step?: number | null;
};
type Demo = {
  id: string; lead_id: string; demo_datetime: string;
  prospect_name: string | null; prospect_business: string | null;
  prospect_phone: string | null; prospect_email: string | null;
  call_summary: string | null; status: string;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    paused: "bg-amber-100 text-amber-800 border-amber-300",
    draft: "bg-muted text-muted-foreground",
    completed: "bg-blue-100 text-blue-800 border-blue-300",
    pending: "bg-muted text-muted-foreground",
    calling: "bg-blue-100 text-blue-800 border-blue-300",
    answered: "bg-blue-50 text-blue-700",
    no_answer: "bg-white text-foreground border",
    voicemail: "bg-muted text-muted-foreground",
    interested: "bg-green-100 text-green-800 border-green-300",
    not_interested: "bg-red-100 text-red-800 border-red-300",
    demo_booked: "bg-green-100 text-green-800 border-green-300",
    do_not_call: "bg-red-100 text-red-800 border-red-300",
    called_back: "bg-purple-100 text-purple-800 border-purple-300",
    hot: "bg-amber-100 text-amber-800 border-amber-300",
    warm: "bg-yellow-100 text-yellow-800 border-yellow-300",
    cold: "bg-slate-100 text-slate-700",
    scheduled: "bg-blue-100 text-blue-800 border-blue-300",
    no_show: "bg-red-100 text-red-800 border-red-300",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status.replace(/_/g, " ")}</Badge>;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGNS TAB
// ─────────────────────────────────────────────────────────────────────────────
function CampaignsTab({ onOpen }: { onOpen: (c: Campaign) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, { leads: number; calls: number; demos: number }>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", calling_days: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    calling_start_hour: 9, calling_end_hour: 18,
    calls_per_day_limit: 50, delay_between_calls_seconds: 30,
    voice: "cedar",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("outbound_campaigns").select("*").order("created_at", { ascending: false });
    setRows((data || []) as Campaign[]);
    const { data: leads } = await supabase.from("outbound_leads").select("campaign_id,status,demo_booked");
    const s: Record<string, { leads: number; calls: number; demos: number }> = {};
    (leads || []).forEach((l: any) => {
      s[l.campaign_id] = s[l.campaign_id] || { leads: 0, calls: 0, demos: 0 };
      s[l.campaign_id].leads++;
      if (l.status !== "pending") s[l.campaign_id].calls++;
      if (l.demo_booked) s[l.campaign_id].demos++;
    });
    setStats(s);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"? This will also delete all its leads. This cannot be undone.`)) return;
    const { error } = await supabase.from("outbound_campaigns").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Campaign deleted" });
    load();
  };
  const setStatus = async (id: string, status: Campaign["status"]) => {
    const { error } = await supabase.from("outbound_campaigns").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const create = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Enter a campaign name first.", variant: "destructive" });
      return;
    }
    if (!form.calling_days || form.calling_days.length === 0) {
      toast({ title: "Pick at least one day", description: "Select the days Aria is allowed to call.", variant: "destructive" });
      return;
    }
    if (form.calling_end_hour <= form.calling_start_hour) {
      toast({ title: "Invalid hours", description: "End hour must be after start hour.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("outbound_campaigns").insert({ ...form, status: "draft" });
    if (error) { toast({ title: "Could not create campaign", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Campaign created" });
    setOpen(false); load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>Manage outbound calling campaigns</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1"/>Create Campaign</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> :
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Status</TableHead>
              <TableHead>Voice</TableHead><TableHead>Leads</TableHead><TableHead>Calls</TableHead>
              <TableHead>Demos</TableHead><TableHead>Success</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(c => {
              const st = stats[c.id] || { leads: 0, calls: 0, demos: 0 };
              const pct = st.calls ? Math.round((st.demos / st.calls) * 100) : 0;
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="capitalize">{c.voice || "cedar"}</TableCell>
                  <TableCell>{st.leads}</TableCell>
                  <TableCell>{st.calls}</TableCell>
                  <TableCell>{st.demos}</TableCell>
                  <TableCell>{pct}%</TableCell>
                  <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                    {c.status !== "active" && c.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "active")}><Play className="w-3 h-3"/></Button>
                    )}
                    {c.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "paused")}><Pause className="w-3 h-3"/></Button>
                    )}
                    {c.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "completed")}><Square className="w-3 h-3"/></Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteCampaign(c.id, c.name)}><Trash2 className="w-3 h-3"/></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No campaigns yet</TableCell></TableRow>}
          </TableBody>
        </Table>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Campaign name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
            </div>
            <div>
              <Label>Calling days</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {DAYS.map(d => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.calling_days.includes(d)} onCheckedChange={(v) => {
                      setForm({...form, calling_days: v ? [...form.calling_days, d] : form.calling_days.filter(x => x !== d)});
                    }}/>
                    {d.slice(0,3)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start hour (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.calling_start_hour}
                  onChange={e => setForm({...form, calling_start_hour: parseInt(e.target.value)||0})}/>
              </div>
              <div>
                <Label>End hour (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.calling_end_hour}
                  onChange={e => setForm({...form, calling_end_hour: parseInt(e.target.value)||0})}/>
              </div>
              <div>
                <Label>Max calls / day</Label>
                <Input type="number" min={1} value={form.calls_per_day_limit}
                  onChange={e => setForm({...form, calls_per_day_limit: parseInt(e.target.value)||1})}/>
              </div>
              <div>
                <Label>Delay between calls (s)</Label>
                <Input type="number" min={0} value={form.delay_between_calls_seconds}
                  onChange={e => setForm({...form, delay_between_calls_seconds: parseInt(e.target.value)||0})}/>
                <p className="text-xs text-muted-foreground mt-1">Gap between individual calls, not between campaign checks.</p>
              </div>
              <div>
                <Label>Voice</Label>
                <Select value={form.voice} onValueChange={v => setForm({...form, voice: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {["alloy","ash","ballad","coral","echo","sage","shimmer","verse","cedar"].map(v => (
                      <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">OpenAI Realtime voice Aria will use.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADS TAB
// ─────────────────────────────────────────────────────────────────────────────
function LeadsTab({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [smsFilter, setSmsFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState<{ first_name: string; business_name: string; phone_number: string; business_type: string }>({ first_name: "", business_name: "", phone_number: "", business_type: "" });
  const [selected, setSelected] = useState<Lead | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("outbound_leads").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false });
    setLeads((data || []) as Lead[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [campaign.id]);

  const filtered = useMemo(() => leads.filter(l =>
    (statusFilter === "all" || l.status === statusFilter) &&
    (interestFilter === "all" || l.interest_level === interestFilter) &&
    (smsFilter === "all" || (smsFilter === "sent" ? l.sms_sent : !l.sms_sent)) &&
    (typeFilter === "all" || (typeFilter === "none" ? !l.business_type : l.business_type === typeFilter))
  ), [leads, statusFilter, interestFilter, smsFilter, typeFilter]);

  const addLead = async () => {
    if (!newLead.phone_number.trim()) return;
    const payload: any = {
      first_name: newLead.first_name || null,
      business_name: newLead.business_name || null,
      phone_number: newLead.phone_number,
      business_type: newLead.business_type || null,
      campaign_id: campaign.id,
    };
    const { error } = await supabase.from("outbound_leads").insert(payload);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setAddOpen(false); setNewLead({ first_name: "", business_name: "", phone_number: "", business_type: "" }); load(); }
  };
  const deleteLead = async (id: string, name: string) => {
    if (!confirm(`Delete lead${name ? ` "${name}"` : ""}? This cannot be undone.`)) return;
    const { error } = await supabase.from("outbound_leads").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Lead deleted" });
    load();
  };

  const importCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idx = (k: string) => headers.indexOf(k);
    const phoneI = idx("phone"); const firstI = idx("first_name"); const bizI = idx("business_name"); const typeI = idx("business_type");
    if (phoneI < 0) { toast({ title: "CSV missing 'phone' column", variant: "destructive" }); return; }
    const allowed = new Set<string>(BUSINESS_TYPES as readonly string[]);
    const rows = lines.slice(1).map(l => {
      const cols = l.split(",").map(c => c.trim());
      const rawType = typeI >= 0 ? (cols[typeI] || "").toLowerCase() : "";
      return {
        campaign_id: campaign.id,
        phone_number: cols[phoneI],
        first_name: firstI >= 0 ? cols[firstI] : null,
        business_name: bizI >= 0 ? cols[bizI] : null,
        business_type: allowed.has(rawType) ? rawType : null,
      };
    }).filter(r => r.phone_number);
    if (!rows.length) return;
    const { error } = await supabase.from("outbound_leads").insert(rows);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: `Imported ${rows.length} leads` }); load(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1"/>Back to campaigns</Button>
            <CardTitle className="mt-2">{campaign.name} — Leads</CardTitle>
          </div>
          <div className="flex gap-2">
            <label className="inline-flex items-center">
              <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && importCSV(e.target.files[0])}/>
              <span className="inline-flex items-center px-3 py-2 text-sm rounded-md border cursor-pointer hover:bg-muted">
                <Upload className="w-4 h-4 mr-1"/>Import CSV
              </span>
            </label>
            <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1"/>Add Lead</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          CSV columns: <code>phone</code> (required), <code>first_name</code>, <code>business_name</code>, <code>business_type</code> (optional — one of: {BUSINESS_TYPES.join(", ")}).
        </p>
        <div className="flex gap-2 mt-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["pending","calling","answered","no_answer","voicemail","called_back","interested","not_interested","demo_booked","do_not_call"].map(s =>
                <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={interestFilter} onValueChange={setInterestFilter}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All interest levels</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={smsFilter} onValueChange={setSmsFilter}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SMS statuses</SelectItem>
              <SelectItem value="sent">SMS sent</SelectItem>
              <SelectItem value="not_sent">SMS not sent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All business types</SelectItem>
              <SelectItem value="none">No type set</SelectItem>
              {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{businessTypeLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> :
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Business</TableHead><TableHead>Type</TableHead><TableHead>Phone</TableHead>
              <TableHead>Status</TableHead><TableHead>Interest</TableHead><TableHead>SMS</TableHead>
              <TableHead>Solution</TableHead><TableHead>Duration</TableHead><TableHead>Last called</TableHead>
              <TableHead>Recording</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                <TableCell>{l.first_name || "—"}</TableCell>
                <TableCell>{l.business_name || "—"}</TableCell>
                <TableCell>{l.business_type ? <Badge variant="outline" className="text-xs">{businessTypeLabel(l.business_type)}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{l.phone_number}</TableCell>
                <TableCell>{statusBadge(l.status)}</TableCell>
                <TableCell>{l.interest_level ? statusBadge(l.interest_level) : "—"}</TableCell>
                <TableCell>
                  {l.sms_sent
                    ? <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Sent</Badge>
                    : <Badge variant="outline" className="bg-muted text-muted-foreground">Not sent</Badge>}
                </TableCell>
                <TableCell className="max-w-[180px] truncate">{l.existing_solution || "—"}</TableCell>
                <TableCell>{l.call_duration_seconds ? `${l.call_duration_seconds}s` : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{l.last_called_at ? new Date(l.last_called_at).toLocaleString() : "—"}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {l.call_recording_url ? <audio controls src={l.call_recording_url} className="h-8"/> : "—"}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()} className="space-x-1">
                  {l.call_transcript && <Button size="sm" variant="ghost" onClick={() => setSelected(l)}><FileText className="w-4 h-4"/></Button>}
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteLead(l.id, l.first_name || l.business_name || l.phone_number)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No leads</TableCell></TableRow>}
          </TableBody>
        </Table>}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>First name</Label><Input value={newLead.first_name} onChange={e => setNewLead({...newLead, first_name: e.target.value})}/></div>
            <div><Label>Business name</Label><Input value={newLead.business_name} onChange={e => setNewLead({...newLead, business_name: e.target.value})}/></div>
            <div><Label>Phone (E.164)</Label><Input value={newLead.phone_number} onChange={e => setNewLead({...newLead, phone_number: e.target.value})} placeholder="+447..."/></div>
            <div>
              <Label>Business type</Label>
              <Select value={newLead.business_type || "__none"} onValueChange={v => setNewLead({...newLead, business_type: v === "__none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="— None —"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{businessTypeLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addLead}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.first_name} — {selected?.business_name}</DialogTitle>
            <DialogDescription>{selected?.phone_number}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                {statusBadge(selected.status)}
                {selected.interest_level && statusBadge(selected.interest_level)}
              </div>
              <div><b>Email:</b> {selected.email || "—"}</div>
              <div><b>SMS sent:</b> {selected.sms_sent ? "Yes" : "No"}</div>
              <div><b>Existing solution:</b> {selected.existing_solution || "—"}</div>
              <div><b>Reason not interested:</b> {selected.reason_not_interested || "—"}</div>
              <div><b>Last called:</b> {selected.last_called_at ? new Date(selected.last_called_at).toLocaleString() : "—"}</div>
              {selected.call_recording_url && <audio controls src={selected.call_recording_url} className="w-full"/>}
              {selected.call_transcript && (
                <div>
                  <b>Transcript</b>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap mt-1">{selected.call_transcript}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMOS TAB
// ─────────────────────────────────────────────────────────────────────────────
type Override = { id: string; date: string; start_time: string | null; end_time: string | null; reason: string | null };

function DemosTab() {
  const { toast } = useToast();
  const [demos, setDemos] = useState<Demo[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("list");
  const [selected, setSelected] = useState<Demo | null>(null);
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [blockRange, setBlockRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: dms }, { data: ovs }] = await Promise.all([
      supabase.from("outbound_demos").select("*").order("demo_datetime", { ascending: true }),
      supabase.from("outbound_availability_overrides").select("*").order("date", { ascending: true }),
    ]);
    setDemos((dms || []) as Demo[]);
    setOverrides((ovs || []) as Override[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);


  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("outbound_demos").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { load(); setSelected(null); }
  };

  const deleteDemo = async (id: string) => {
    if (!confirm("Delete this demo? This cannot be undone.")) return;
    const { error } = await supabase.from("outbound_demos").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Demo deleted" });
    setSelected(null);
    load();
  };

  const formatDemoWhen = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${date} at ${time}`;
  };

  const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const overridesByDate = useMemo(() => {
    const m: Record<string, Override[]> = {};
    overrides.forEach(o => { (m[o.date] ||= []).push(o); });
    return m;
  }, [overrides]);

  // Build month grid
  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null; demos: Demo[]; blocks: Override[]; fullBlocked: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, demos: [], blocks: [], fullBlocked: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month, d);
      const dayDemos = demos.filter(x => {
        const xd = new Date(x.demo_datetime);
        return xd.getFullYear() === year && xd.getMonth() === month && xd.getDate() === d;
      });
      const blocks = overridesByDate[ymdLocal(day)] || [];
      const fullBlocked = blocks.some(b => !b.start_time && !b.end_time);
      cells.push({ date: day, demos: dayDemos, blocks, fullBlocked });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, demos: [], blocks: [], fullBlocked: false });
    return cells;
  }, [cursor, demos, overridesByDate]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  const blockFullDay = async (d: Date) => {
    const { error } = await supabase.from("outbound_availability_overrides").insert({ date: ymdLocal(d) });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Day blocked", description: "Aria will not book any demos on this day." }); load(); }
  };
  const blockTimeRange = async (d: Date) => {
    if (!blockRange.start || !blockRange.end) { toast({ title: "Pick a start and end time", variant: "destructive" }); return; }
    const { error } = await supabase.from("outbound_availability_overrides").insert({
      date: ymdLocal(d), start_time: blockRange.start, end_time: blockRange.end,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setBlockRange({ start: "", end: "" }); toast({ title: "Time range blocked" }); load(); }
  };
  const unblock = async (id: string) => {
    const { error } = await supabase.from("outbound_availability_overrides").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Demos</CardTitle><CardDescription>Booked demos from outbound calls</CardDescription></div>
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>List</Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}>Calendar</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> :
         view === "list" ? (
          <div className="space-y-2">
            {demos.map(d => (
              <div key={d.id} className="border rounded-md p-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelected(d)}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{d.prospect_name} — {d.prospect_business}</div>
                    <div className="text-sm text-muted-foreground">{d.prospect_phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatDemoWhen(d.demo_datetime)}</div>
                    {statusBadge(d.status)}
                  </div>
                </div>
              </div>
            ))}
            {demos.length === 0 && <p className="text-center text-muted-foreground py-8">No demos booked yet</p>}
          </div>
         ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</Button>
              <div className="font-semibold">{monthLabel}</div>
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="text-center py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => (
                <div key={i}
                  onClick={() => cell.date && setDayOpen(cell.date)}
                  className={`border rounded-md min-h-[90px] p-1 relative overflow-hidden ${cell.date ? "cursor-pointer hover:bg-muted/40" : "bg-muted/20"} ${cell.date && isToday(cell.date) ? "border-primary bg-primary/5" : ""} ${cell.fullBlocked ? "bg-red-50 border-red-300" : ""}`}>
                  {cell.date && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium">{cell.date.getDate()}</div>
                        {cell.blocks.length > 0 && <div className="text-[9px] text-red-700 font-medium uppercase">Blocked</div>}
                      </div>
                      <div className="space-y-1">
                        {cell.demos.slice(0, 3).map(d => (
                          <button key={d.id}
                            onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                            className="w-full text-left text-[10px] bg-primary/10 hover:bg-primary/20 rounded px-1 py-0.5 truncate">
                            {new Date(d.demo_datetime).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})} {d.prospect_name || ""}
                          </button>
                        ))}
                        {cell.demos.length > 3 && <div className="text-[10px] text-muted-foreground">+{cell.demos.length - 3} more</div>}
                        {!cell.fullBlocked && cell.blocks.filter(b => b.start_time && b.end_time).slice(0,2).map(b => (
                          <div key={b.id} className="text-[10px] bg-red-100 text-red-800 rounded px-1 py-0.5 truncate">
                            Blocked {b.start_time?.slice(0,5)}–{b.end_time?.slice(0,5)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>


            {demos.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No demos booked yet</p>}
          </div>
         )}
      </CardContent>

      <Dialog open={!!dayOpen} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dayOpen?.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</DialogTitle>
            <DialogDescription>
              {dayOpen && (() => {
                const list = demos.filter(x => {
                  const xd = new Date(x.demo_datetime);
                  return xd.toDateString() === dayOpen.toDateString();
                });
                return `${list.length} demo${list.length === 1 ? "" : "s"} scheduled`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dayOpen && (() => {
              const list = demos
                .filter(x => new Date(x.demo_datetime).toDateString() === dayOpen.toDateString())
                .sort((a, b) => new Date(a.demo_datetime).getTime() - new Date(b.demo_datetime).getTime());
              if (!list.length) return <p className="text-center text-muted-foreground py-6">No demos on this day</p>;
              return list.map(d => (
                <div key={d.id} className="border rounded-md p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelected(d); setDayOpen(null); }}>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.prospect_name || "—"} — {d.prospect_business || "—"}</div>
                      <div className="text-sm text-muted-foreground">{d.prospect_phone || "—"}{d.prospect_email ? ` · ${d.prospect_email}` : ""}</div>
                      {d.call_summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.call_summary}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium">{new Date(d.demo_datetime).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</div>
                      <div className="mt-1">{statusBadge(d.status)}</div>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>

          {dayOpen && (
            <div className="border-t pt-3 mt-3 space-y-3">
              <div className="text-sm font-semibold">Block this day from the AI</div>
              {(overridesByDate[ymdLocal(dayOpen)] || []).length > 0 && (
                <div className="space-y-1">
                  {(overridesByDate[ymdLocal(dayOpen)] || []).map(b => (
                    <div key={b.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-2 py-1 text-xs">
                      <span className="text-red-800">
                        {b.start_time && b.end_time
                          ? `${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)} blocked`
                          : "Whole day blocked"}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => unblock(b.id)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end flex-wrap">
                <Button size="sm" variant="outline" onClick={() => dayOpen && blockFullDay(dayOpen)}>Block whole day</Button>
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input type="time" value={blockRange.start} onChange={e => setBlockRange({ ...blockRange, start: e.target.value })} className="w-28 h-8"/>
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input type="time" value={blockRange.end} onChange={e => setBlockRange({ ...blockRange, end: e.target.value })} className="w-28 h-8"/>
                  </div>
                  <Button size="sm" onClick={() => dayOpen && blockTimeRange(dayOpen)}>Block range</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Aria will not book any demo inside a blocked window.</p>
            </div>
          )}

        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>

        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.prospect_name} — {selected?.prospect_business}</DialogTitle>
            <DialogDescription>{selected && formatDemoWhen(selected.demo_datetime)}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div>{statusBadge(selected.status)}</div>
              <div><b>Scheduled for:</b> {formatDemoWhen(selected.demo_datetime)}</div>
              <div><b>Phone:</b> {selected.prospect_phone}</div>
              <div><b>Email:</b> {selected.prospect_email || "—"}</div>
              <div><b>Summary:</b><br/>{selected.call_summary || "—"}</div>
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" onClick={() => setStatus(selected.id, "completed")}>Mark Completed</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, "no_show")}>No Show</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, "cancelled")}>Cancel</Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive ml-auto" onClick={() => deleteDemo(selected.id)}><Trash2 className="w-4 h-4 mr-1"/>Delete</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// RESULTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ResultsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("outbound_leads").select("*");
      setLeads((data || []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto"/>;

  const totalCalls = leads.filter(l => l.status !== "pending").length;
  const answered = leads.filter(l => !["pending","no_answer","voicemail"].includes(l.status)).length;
  const interested = leads.filter(l => ["interested","demo_booked"].includes(l.status)).length;
  const demos = leads.filter(l => l.demo_booked).length;
  const pct = (n: number, d: number) => d ? Math.round((n/d)*100) : 0;

  const outcomes: Record<string, number> = {};
  leads.forEach(l => { outcomes[l.status] = (outcomes[l.status]||0)+1; });

  const solutions: Record<string, number> = {};
  leads.forEach(l => { if (l.existing_solution) {
    const k = l.existing_solution.trim().slice(0,40);
    solutions[k] = (solutions[k]||0)+1;
  }});
  const reasons: Record<string, number> = {};
  leads.forEach(l => { if (l.reason_not_interested) {
    const k = l.reason_not_interested.trim().slice(0,40);
    reasons[k] = (reasons[k]||0)+1;
  }});

  const topN = (m: Record<string, number>, n = 5) => Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total calls", totalCalls],
          ["Answer rate", `${pct(answered, totalCalls)}%`],
          ["Interest rate", `${pct(interested, totalCalls)}%`],
          ["Demo booked rate", `${pct(demos, totalCalls)}%`],
        ].map(([k, v]) => (
          <Card key={k as string}><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{k}</div><div className="text-2xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Outcome distribution</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(outcomes).map(([k,v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span>{statusBadge(k)}</span><span>{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Top existing solutions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {topN(solutions).map(([k,v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}
            {!Object.keys(solutions).length && <p className="text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top rejection reasons</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {topN(reasons).map(([k,v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}
            {!Object.keys(reasons).length && <p className="text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT TAB
// ─────────────────────────────────────────────────────────────────────────────
function PromptTab() {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string>("");
  const [fromNumber, setFromNumber] = useState("");
  const [retellAgentId, setRetellAgentId] = useState("");
  const [moPhoneNumber, setMoPhoneNumber] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("Aivia");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/retell-call-webhook`;

  const voicemailScript = `Hi {{first_name}}, this is Aria calling on behalf of Aivia. I tried to reach you about how {{business_name}} could automatically answer every call you are currently missing. If that sounds interesting, call Mo directly on ${moPhoneNumber || "[your number]"} or visit aiviaapp.co.uk. Have a great day.`;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("outbound_settings").select("*").limit(1).maybeSingle();
      if (data) {
        setRowId(data.id);
        setFromNumber(data.from_number || "");
        setRetellAgentId((data as any).retell_agent_id || "");
        setMoPhoneNumber((data as any).mo_phone_number || "");
        setSmsSenderId((data as any).sms_sender_id || "Aivia");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const trimmedSender = smsSenderId.trim();
    if (!/^[A-Za-z0-9]{1,11}$/.test(trimmedSender)) {
      toast({ title: "Invalid SMS Sender Name", description: "Max 11 characters, letters and numbers only.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("outbound_settings").update({
      from_number: fromNumber || null,
      retell_agent_id: retellAgentId || null,
      mo_phone_number: moPhoneNumber || null,
      sms_sender_id: trimmedSender,
    } as any).eq("id", rowId);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Changes take effect on the next call." });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Could not copy", description: text, variant: "destructive" });
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto"/>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retell Settings</CardTitle>
        <CardDescription>The prompt itself is managed inside Retell on the agent. Aivia only needs the agent ID and the caller ID.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wide">Retell webhook URL</Label>
          <p className="text-xs text-muted-foreground">
            In Retell, open the Outreach Dialer agent → Settings → Webhook URL and paste this. Save in Retell after pasting.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs"/>
            <Button type="button" variant="outline" onClick={() => copyText(webhookUrl, "Webhook URL")}>Copy</Button>
          </div>
        </div>
        <div>
          <Label>Retell Agent ID</Label>
          <Input value={retellAgentId} onChange={e => setRetellAgentId(e.target.value)} placeholder="agent_..."/>
          <p className="text-xs text-muted-foreground mt-1">Find this in your Retell dashboard under Agents. Copy the ID that starts with <code>agent_</code>.</p>
        </div>
        <div>
          <Label>Outbound caller ID (E.164 Twilio number)</Label>
          <Input value={fromNumber} onChange={e => setFromNumber(e.target.value)} placeholder="+44..."/>
        </div>
        <div>
          <Label>Mo's callback number (E.164)</Label>
          <Input value={moPhoneNumber} onChange={e => setMoPhoneNumber(e.target.value)} placeholder="+44..."/>
          <p className="text-xs text-muted-foreground mt-1">Your callback number — shown in SMS and voicemail to prospects.</p>
          {!moPhoneNumber && (
            <p className="text-xs text-amber-600 mt-1">⚠️ SMS follow-ups are disabled until this number is set.</p>
          )}
        </div>
        <div>
          <Label>SMS Sender Name</Label>
          <Input value={smsSenderId} onChange={e => setSmsSenderId(e.target.value)} placeholder="Aivia" maxLength={11}/>
          <p className="text-xs text-muted-foreground mt-1">Max 11 characters, letters and numbers only. Recipients see this instead of a phone number.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1"/>Save</Button>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wide">Recommended voicemail script — paste this into Retell</Label>
          <p className="text-xs text-muted-foreground">
            Configure this in Retell on the Outreach Dialer agent's voicemail message field. <code>{"{{first_name}}"}</code> and <code>{"{{business_name}}"}</code> are dynamic variables Aivia passes per call.
          </p>
          <Textarea readOnly value={voicemailScript} rows={5} className="font-mono text-xs"/>
          <Button type="button" variant="outline" size="sm" onClick={() => copyText(voicemailScript, "Voicemail script")}>Copy script</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY TAB
// ─────────────────────────────────────────────────────────────────────────────
type WeeklyHours = Record<string, { enabled: boolean; start: string; end: string }>;
const WEEKDAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

function AvailabilityTab() {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<WeeklyHours>({});
  const [duration, setDuration] = useState(15);
  const [buffer, setBuffer] = useState(15);
  const [minNotice, setMinNotice] = useState(2);
  const [maxDay, setMaxDay] = useState(4);
  const [tz, setTz] = useState("Europe/London");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("outbound_availability").select("*").limit(1).maybeSingle();
      if (data) {
        setRowId(data.id);
        setHours((data.weekly_hours as WeeklyHours) || {});
        setDuration(data.demo_duration_minutes);
        setBuffer(data.buffer_minutes);
        setMinNotice(data.min_notice_hours);
        setMaxDay(data.max_demos_per_day);
        setTz(data.timezone);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("outbound_availability").update({
      weekly_hours: hours,
      demo_duration_minutes: duration,
      buffer_minutes: buffer,
      min_notice_hours: minNotice,
      max_demos_per_day: maxDay,
      timezone: tz,
    }).eq("id", rowId);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Availability saved", description: "Aria will use these rules on the next call." });
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto"/>;

  const updateDay = (k: string, patch: Partial<{ enabled: boolean; start: string; end: string }>) => {
    setHours({ ...hours, [k]: { ...(hours[k] || { enabled: false, start: "10:00", end: "17:00" }), ...patch } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>Aria only books demos inside these windows, respecting buffers and existing demos. Use the Demos calendar to block specific dates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base">Weekly working hours</Label>
          <div className="mt-3 space-y-2">
            {WEEKDAY_KEYS.map(k => {
              const h = hours[k] || { enabled: false, start: "10:00", end: "17:00" };
              return (
                <div key={k} className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 w-32">
                    <Checkbox checked={h.enabled} onCheckedChange={(v) => updateDay(k, { enabled: !!v })}/>
                    <span className="capitalize text-sm">{k}</span>
                  </div>
                  <Input type="time" value={h.start} onChange={e => updateDay(k, { start: e.target.value })} disabled={!h.enabled} className="w-32 h-9"/>
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" value={h.end} onChange={e => updateDay(k, { end: e.target.value })} disabled={!h.enabled} className="w-32 h-9"/>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Demo length (min)</Label>
            <Input type="number" min={5} max={120} value={duration} onChange={e => setDuration(parseInt(e.target.value)||15)}/>
          </div>
          <div>
            <Label>Buffer between demos (min)</Label>
            <Input type="number" min={0} max={120} value={buffer} onChange={e => setBuffer(parseInt(e.target.value)||0)}/>
          </div>
          <div>
            <Label>Minimum notice (hours)</Label>
            <Input type="number" min={0} max={72} value={minNotice} onChange={e => setMinNotice(parseInt(e.target.value)||0)}/>
          </div>
          <div>
            <Label>Max demos / day</Label>
            <Input type="number" min={1} max={20} value={maxDay} onChange={e => setMaxDay(parseInt(e.target.value)||1)}/>
          </div>
        </div>

        <div>
          <Label>Timezone</Label>
          <Input value={tz} onChange={e => setTz(e.target.value)} placeholder="Europe/London"/>
          <p className="text-xs text-muted-foreground mt-1">IANA timezone name. All times above are interpreted in this zone.</p>
        </div>

        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1"/>Save availability</Button>
      </CardContent>
    </Card>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TEST TAB — place a one-off outbound call to a number you choose
// ─────────────────────────────────────────────────────────────────────────────
function TestTab({ campaigns }: { campaigns: Campaign[] }) {
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [placing, setPlacing] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; sid?: string; leadId?: string } | null>(null);

  useEffect(() => {
    if (!campaignId && campaigns.length) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  const placeTestCall = async () => {
    if (!campaignId) {
      toast({ title: "Pick a campaign", description: "Test calls reuse a campaign's settings and prompt.", variant: "destructive" });
      return;
    }
    const normalized = phone.trim();
    if (!/^\+?[0-9\s\-()]{7,}$/.test(normalized)) {
      toast({ title: "Invalid phone number", description: "Use international format, e.g. +447700900123.", variant: "destructive" });
      return;
    }
    setPlacing(true);
    setLastResult(null);
    try {
      const { data: lead, error: leadErr } = await supabase
        .from("outbound_leads")
        .insert({
          campaign_id: campaignId,
          phone_number: normalized,
          first_name: firstName.trim() || "Test",
          business_name: businessName.trim() || "Test Call",
          status: "pending",
        })
        .select("id")
        .single();
      if (leadErr || !lead) throw new Error(leadErr?.message || "Failed to create test lead");

      const { data, error } = await supabase.functions.invoke("twilio-outbound-call", {
        body: { lead_id: lead.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Call did not start");

      setLastResult({ ok: true, message: "Call placed — your phone should ring shortly.", sid: data.sid, leadId: lead.id });
      toast({ title: "Test call placed", description: `Twilio SID: ${data.sid}` });
    } catch (e: any) {
      setLastResult({ ok: false, message: e.message || String(e) });
      toast({ title: "Test call failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test outbound call</CardTitle>
        <CardDescription>
          Place a live call to any number using a campaign's settings and Aria's current prompt. A temporary lead is
          created so the call also appears in Leads and Results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        {campaigns.length === 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3">
            You need at least one campaign before placing a test call. Create one in the <b>Campaigns</b> tab — test calls reuse its voice, prompt, and settings.
          </div>
        )}
        <div>
          <Label>Phone number to call</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+447700900123"/>
          <p className="text-xs text-muted-foreground mt-1">International format including the country code.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prospect name (optional)</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Test"/>
          </div>
          <div>
            <Label>Business name (optional)</Label>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Test Call"/>
          </div>
        </div>
        <Button onClick={placeTestCall} disabled={placing || !campaignId}>
          {placing ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Play className="w-4 h-4 mr-1"/>}
          Place test call
        </Button>
        {lastResult && (
          <div className={`text-sm rounded-md border p-3 ${lastResult.ok ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"}`}>
            <div className="font-medium">{lastResult.ok ? "Call placed" : "Call failed"}</div>
            <div className="mt-1">{lastResult.message}</div>
            {lastResult.sid && <div className="mt-1 text-xs opacity-80">Twilio SID: {lastResult.sid}</div>}
          </div>
        )}
        <div className="text-xs text-muted-foreground border-t pt-3">
          The test call bypasses campaign day/hour windows because it's manually triggered, but Aria still respects
          your Availability settings when offering demo slots. Recording and transcript appear under Leads once the
          call ends.
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARENT
// ─────────────────────────────────────────────────────────────────────────────
export function OutboundCampaignsSection() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tab, setTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    supabase.from("outbound_campaigns").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setCampaigns((data || []) as Campaign[]));
  }, [tab]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="demos">Demos</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="availability">Availability</TabsTrigger>
        <TabsTrigger value="prompt">Retell Settings</TabsTrigger>
        <TabsTrigger value="test">Test</TabsTrigger>
      </TabsList>
      <TabsContent value="campaigns" className="mt-4">
        <CampaignsTab onOpen={(c) => { setCampaign(c); setTab("leads"); }}/>
      </TabsContent>
      <TabsContent value="leads" className="mt-4">
        {campaign ? (
          <LeadsTab campaign={campaign} onBack={() => { setCampaign(null); setTab("campaigns"); }}/>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>Pick a campaign to view and manage its leads.</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No campaigns yet. Create one in the Campaigns tab.</p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <button key={c.id} onClick={() => setCampaign(c)}
                      className="w-full text-left border rounded-md p-3 hover:bg-muted/50 flex justify-between items-center">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">Created {new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                      {statusBadge(c.status)}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="demos" className="mt-4"><DemosTab/></TabsContent>
      <TabsContent value="results" className="mt-4"><ResultsTab/></TabsContent>
      <TabsContent value="availability" className="mt-4"><AvailabilityTab/></TabsContent>
      <TabsContent value="prompt" className="mt-4"><PromptTab/></TabsContent>
      <TabsContent value="test" className="mt-4"><TestTab campaigns={campaigns}/></TabsContent>
    </Tabs>
  );
}

