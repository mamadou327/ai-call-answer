import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Pause, Square, ChevronLeft, Upload, Plus, FileText, RotateCcw, Save } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Campaign = {
  id: string; name: string; status: "draft" | "active" | "paused" | "completed";
  calling_days: string[]; calling_start_hour: number; calling_end_hour: number;
  calls_per_day_limit: number; delay_between_calls_seconds: number;
  created_at: string;
};
type Lead = {
  id: string; campaign_id: string; first_name: string | null; business_name: string | null;
  phone_number: string; email: string | null;
  status: string; interest_level: string | null; existing_solution: string | null;
  reason_not_interested: string | null; demo_booked: boolean;
  call_duration_seconds: number | null; call_recording_url: string | null;
  call_transcript: string | null; last_called_at: string | null; created_at: string;
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

  const setStatus = async (id: string, status: Campaign["status"]) => {
    const { error } = await supabase.from("outbound_campaigns").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const create = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("outbound_campaigns").insert({ ...form, status: "draft" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
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
              <TableHead>Leads</TableHead><TableHead>Calls</TableHead>
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
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No campaigns yet</TableCell></TableRow>}
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
  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ first_name: "", business_name: "", phone_number: "" });
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
    (interestFilter === "all" || l.interest_level === interestFilter)
  ), [leads, statusFilter, interestFilter]);

  const addLead = async () => {
    if (!newLead.phone_number.trim()) return;
    const { error } = await supabase.from("outbound_leads").insert({ ...newLead, campaign_id: campaign.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setAddOpen(false); setNewLead({ first_name: "", business_name: "", phone_number: "" }); load(); }
  };

  const importCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idx = (k: string) => headers.indexOf(k);
    const phoneI = idx("phone"); const firstI = idx("first_name"); const bizI = idx("business_name");
    if (phoneI < 0) { toast({ title: "CSV missing 'phone' column", variant: "destructive" }); return; }
    const rows = lines.slice(1).map(l => {
      const cols = l.split(",").map(c => c.trim());
      return {
        campaign_id: campaign.id,
        phone_number: cols[phoneI],
        first_name: firstI >= 0 ? cols[firstI] : null,
        business_name: bizI >= 0 ? cols[bizI] : null,
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
        <div className="flex gap-2 mt-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["pending","calling","answered","no_answer","voicemail","interested","not_interested","demo_booked","do_not_call"].map(s =>
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
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> :
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Business</TableHead><TableHead>Phone</TableHead>
              <TableHead>Status</TableHead><TableHead>Interest</TableHead>
              <TableHead>Solution</TableHead><TableHead>Duration</TableHead>
              <TableHead>Recording</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                <TableCell>{l.first_name || "—"}</TableCell>
                <TableCell>{l.business_name || "—"}</TableCell>
                <TableCell>{l.phone_number}</TableCell>
                <TableCell>{statusBadge(l.status)}</TableCell>
                <TableCell>{l.interest_level ? statusBadge(l.interest_level) : "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{l.existing_solution || "—"}</TableCell>
                <TableCell>{l.call_duration_seconds ? `${l.call_duration_seconds}s` : "—"}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {l.call_recording_url ? <audio controls src={l.call_recording_url} className="h-8"/> : "—"}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {l.call_transcript && <Button size="sm" variant="ghost" onClick={() => setSelected(l)}><FileText className="w-4 h-4"/></Button>}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No leads</TableCell></TableRow>}
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

  // Build month grid
  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null; demos: Demo[] }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, demos: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month, d);
      const dayDemos = demos.filter(x => {
        const xd = new Date(x.demo_datetime);
        return xd.getFullYear() === year && xd.getMonth() === month && xd.getDate() === d;
      });
      cells.push({ date: day, demos: dayDemos });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, demos: [] });
    return cells;
  }, [cursor, demos]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

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
                    <div>{new Date(d.demo_datetime).toLocaleString()}</div>
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
                  className={`border rounded-md min-h-[90px] p-1 ${cell.date ? "cursor-pointer hover:bg-muted/40" : "bg-muted/20"} ${cell.date && isToday(cell.date) ? "border-primary bg-primary/5" : ""}`}>
                  {cell.date && (
                    <>
                      <div className="text-xs font-medium mb-1">{cell.date.getDate()}</div>
                      <div className="space-y-1">
                        {cell.demos.slice(0, 3).map(d => (
                          <button key={d.id}
                            onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                            className="w-full text-left text-[10px] bg-primary/10 hover:bg-primary/20 rounded px-1 py-0.5 truncate">
                            {new Date(d.demo_datetime).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})} {d.prospect_name || ""}
                          </button>
                        ))}
                        {cell.demos.length > 3 && <div className="text-[10px] text-muted-foreground">+{cell.demos.length - 3} more</div>}
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
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>

        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.prospect_name} — {selected?.prospect_business}</DialogTitle>
            <DialogDescription>{selected && new Date(selected.demo_datetime).toLocaleString()}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div>{statusBadge(selected.status)}</div>
              <div><b>Phone:</b> {selected.prospect_phone}</div>
              <div><b>Email:</b> {selected.prospect_email || "—"}</div>
              <div><b>Summary:</b><br/>{selected.call_summary || "—"}</div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => setStatus(selected.id, "completed")}>Mark Completed</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, "no_show")}>No Show</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, "cancelled")}>Cancel</Button>
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
const DEFAULT_PROMPT = `You are Aria, an AI calling on behalf of Aivia. You are calling {{first_name}} at {{business_name}}. You are genuinely an AI and you say so from the very start because you are a live demonstration of the product you are selling. Every business owner who hears how natural and professional you sound is already experiencing what Aivia would do for their business every single day.

Your only goal is to have a genuine conversation and if they are a good fit book a free 15 minute demo call with Mo the founder of Aivia.`;

function PromptTab() {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("outbound_settings").select("*").limit(1).maybeSingle();
      if (data) { setRowId(data.id); setPrompt(data.outbound_prompt || ""); setFromNumber(data.from_number || ""); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("outbound_settings").update({ outbound_prompt: prompt, from_number: fromNumber || null }).eq("id", rowId);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Changes take effect on the next call." });
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto"/>;

  return (
    <Card>
      <CardHeader><CardTitle>AI Prompt</CardTitle><CardDescription>Changes take effect on the next call made.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Outbound caller ID (E.164 Twilio number)</Label>
          <Input value={fromNumber} onChange={e => setFromNumber(e.target.value)} placeholder="+44..."/>
        </div>
        <div>
          <Label>Outbound sales prompt</Label>
          <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[500px] font-mono text-xs"/>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1"/>Save Prompt</Button>
          <Button variant="outline" onClick={() => setPrompt(DEFAULT_PROMPT)}><RotateCcw className="w-4 h-4 mr-1"/>Reset to default</Button>
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
        <TabsTrigger value="prompt">AI Prompt</TabsTrigger>
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
      <TabsContent value="prompt" className="mt-4"><PromptTab/></TabsContent>
    </Tabs>
  );
}

