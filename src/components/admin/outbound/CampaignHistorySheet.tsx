import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Phone, Mail, Pencil, Archive, ArchiveRestore, Trash2,
  CheckCircle2, AlertTriangle, Activity, RefreshCw,
} from "lucide-react";

export type CampaignEvent = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
};

type Filter = "all" | "calls" | "emails" | "edits" | "status";

const PAGE = 100;

const iconFor = (type: string) => {
  if (type.startsWith("call_")) return <Phone className="w-4 h-4 text-blue-600" />;
  if (type.startsWith("email_")) return <Mail className="w-4 h-4 text-purple-600" />;
  if (type === "lead_updated") return <Pencil className="w-4 h-4 text-amber-600" />;
  if (type.endsWith("_archived")) return <Archive className="w-4 h-4 text-muted-foreground" />;
  if (type.endsWith("_restored")) return <ArchiveRestore className="w-4 h-4 text-muted-foreground" />;
  if (type.endsWith("_deleted")) return <Trash2 className="w-4 h-4 text-red-600" />;
  if (type.includes("status_changed") || type === "lead_created" || type === "campaign_created") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (type.endsWith("_failed")) return <AlertTriangle className="w-4 h-4 text-red-600" />;
  return <Activity className="w-4 h-4 text-muted-foreground" />;
};

const matchesFilter = (type: string, f: Filter) => {
  if (f === "all") return true;
  if (f === "calls") return type.startsWith("call_");
  if (f === "emails") return type.startsWith("email_");
  if (f === "edits") return type === "lead_updated" || type === "lead_created" || type === "campaign_created";
  if (f === "status") return type.includes("status_changed") || type.endsWith("_archived") || type.endsWith("_restored") || type.endsWith("_deleted");
  return true;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDayHeader = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return "Today";
  if (dd.getTime() === yest.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
};

export function CampaignHistorySheet({ open, onOpenChange, campaignId, campaignName }: Props) {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async (reset = true) => {
    setLoading(true);
    const offset = reset ? 0 : events.length;
    const { data, error } = await supabase
      .from("outbound_campaign_events" as any)
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (!error && data) {
      const rows = data as unknown as CampaignEvent[];
      setEvents(reset ? rows : [...events, ...rows]);
      setHasMore(rows.length === PAGE);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) { setEvents([]); setExpanded({}); load(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (!matchesFilter(e.event_type, filter)) return false;
      if (!q) return true;
      return (
        e.message.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        JSON.stringify(e.details).toLowerCase().includes(q)
      );
    });
  }, [events, filter, search]);

  const grouped = useMemo(() => {
    const groups: { day: string; items: CampaignEvent[] }[] = [];
    for (const e of filtered) {
      const day = fmtDayHeader(e.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(e);
      else groups.push({ day, items: [e] });
    }
    return groups;
  }, [filtered]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle>Campaign history</SheetTitle>
          <SheetDescription className="truncate">{campaignName}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {(["all", "calls", "emails", "edits", "status"] as Filter[]).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className="h-7 px-2 capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7 px-2 ml-auto" onClick={() => load(true)} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <Input
            placeholder="Search messages, leads, details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 mt-2"
          />
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          {loading && events.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No activity yet.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(g => (
                <div key={g.day}>
                  <div className="sticky top-0 bg-background pb-1 mb-2">
                    <Badge variant="outline" className="text-xs">{g.day}</Badge>
                  </div>
                  <ol className="space-y-2">
                    {g.items.map(e => {
                      const hasDetails = e.details && Object.keys(e.details).length > 0;
                      const isOpen = !!expanded[e.id];
                      return (
                        <li key={e.id} className="flex gap-3 text-sm">
                          <div className="mt-0.5">{iconFor(e.event_type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(e.created_at)}</span>
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">{e.event_type.replace(/_/g, " ")}</span>
                            </div>
                            <div className="text-foreground break-words">{e.message}</div>
                            {hasDetails && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground underline mt-0.5"
                                onClick={() => setExpanded(s => ({ ...s, [e.id]: !s[e.id] }))}
                              >
                                {isOpen ? "Hide details" : "Show details"}
                              </button>
                            )}
                            {hasDetails && isOpen && (
                              <pre className="mt-1 text-[11px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(e.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button size="sm" variant="outline" onClick={() => load(false)} disabled={loading}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/** Convenience client-side logger. Safe to call without await. */
export async function logCampaignEvent(args: {
  campaign_id: string;
  event_type: string;
  message: string;
  lead_id?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_campaign_event" as any, {
      p_campaign_id: args.campaign_id,
      p_event_type: args.event_type,
      p_message: args.message,
      p_lead_id: args.lead_id ?? null,
      p_details: (args.details ?? {}) as any,
    });
  } catch (e) {
    console.warn("[logCampaignEvent] failed", e);
  }
}
