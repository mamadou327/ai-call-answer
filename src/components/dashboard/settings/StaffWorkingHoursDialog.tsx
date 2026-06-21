import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const DAYS: { key: string; label: string; dayOfWeek: number }[] = [
  { key: "monday", label: "Monday", dayOfWeek: 1 },
  { key: "tuesday", label: "Tuesday", dayOfWeek: 2 },
  { key: "wednesday", label: "Wednesday", dayOfWeek: 3 },
  { key: "thursday", label: "Thursday", dayOfWeek: 4 },
  { key: "friday", label: "Friday", dayOfWeek: 5 },
  { key: "saturday", label: "Saturday", dayOfWeek: 6 },
  { key: "sunday", label: "Sunday", dayOfWeek: 0 },
];

interface DayHours {
  isOff: boolean;
  start: string;
  end: string;
  break_start?: string;
  break_end?: string;
}

type WorkingHours = Record<string, DayHours>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffName: string;
  businessId: string;
}

const emptyDay: DayHours = { isOff: false, start: "09:00", end: "17:00" };

export const StaffWorkingHoursDialog = ({ open, onOpenChange, staffId, staffName, businessId }: Props) => {
  const { toast } = useToast();
  const [hours, setHours] = useState<WorkingHours>(() =>
    Object.fromEntries(DAYS.map((d) => [d.key, { ...emptyDay }])),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !staffId) return;
    setLoading(true);
    (async () => {
      const [{ data: staffRow }, { data: openingRows }] = await Promise.all([
        supabase.from("staff").select("working_hours").eq("id", staffId).maybeSingle(),
        supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", businessId),
      ]);

      const wh = (staffRow?.working_hours as WorkingHours | null) || null;
      const openingByDay: Record<number, { open: string; close: string; closed: boolean }> = {};
      (openingRows || []).forEach((r: any) => {
        openingByDay[r.day_of_week] = {
          open: (r.open_time || "09:00").slice(0, 5),
          close: (r.close_time || "17:00").slice(0, 5),
          closed: !!r.is_closed,
        };
      });

      const seeded: WorkingHours = {};
      for (const d of DAYS) {
        const existing = wh?.[d.key];
        if (existing) {
          seeded[d.key] = {
            isOff: !!existing.isOff,
            start: (existing.start || "09:00").slice(0, 5),
            end: (existing.end || "17:00").slice(0, 5),
            break_start: existing.break_start ? existing.break_start.slice(0, 5) : undefined,
            break_end: existing.break_end ? existing.break_end.slice(0, 5) : undefined,
          };
        } else {
          const biz = openingByDay[d.dayOfWeek];
          seeded[d.key] = biz
            ? { isOff: biz.closed, start: biz.open, end: biz.close }
            : { ...emptyDay };
        }
      }
      setHours(seeded);
      setLoading(false);
    })();
  }, [open, staffId, businessId]);

  const update = (key: string, patch: Partial<DayHours>) => {
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  };

  const save = async () => {
    // Validate ordering
    for (const d of DAYS) {
      const h = hours[d.key];
      if (h.isOff) continue;
      if (h.start >= h.end) {
        toast({ title: "Invalid hours", description: `${d.label}: end time must be after start time.`, variant: "destructive" });
        return;
      }
      if (h.break_start && h.break_end) {
        if (h.break_start >= h.break_end) {
          toast({ title: "Invalid break", description: `${d.label}: break end must be after break start.`, variant: "destructive" });
          return;
        }
        if (h.break_start < h.start || h.break_end > h.end) {
          toast({ title: "Break outside shift", description: `${d.label}: break must fall within working hours.`, variant: "destructive" });
          return;
        }
      }
    }

    setSaving(true);
    // Strip undefined break fields for clean storage
    const payload: WorkingHours = {};
    for (const d of DAYS) {
      const h = hours[d.key];
      const entry: DayHours = { isOff: h.isOff, start: h.start, end: h.end };
      if (h.break_start && h.break_end) {
        entry.break_start = h.break_start;
        entry.break_end = h.break_end;
      }
      payload[d.key] = entry;
    }

    const { error } = await supabase.from("staff").update({ working_hours: payload as any }).eq("id", staffId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hours saved", description: `${staffName}'s working hours updated.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Working hours — {staffName}</DialogTitle>
          <DialogDescription>
            Set the days and times this staff member is available. The AI receptionist and online booking will only offer slots within these hours.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {DAYS.map((d) => {
              const h = hours[d.key];
              const hasBreak = !!(h.break_start && h.break_end);
              return (
                <div key={d.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">{d.label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{h.isOff ? "Off" : "Working"}</span>
                      <Switch checked={!h.isOff} onCheckedChange={(v) => update(d.key, { isOff: !v })} />
                    </div>
                  </div>

                  {!h.isOff && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Start</Label>
                          <Input type="time" value={h.start} onChange={(e) => update(d.key, { start: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End</Label>
                          <Input type="time" value={h.end} onChange={(e) => update(d.key, { end: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Break start (optional)</Label>
                          <Input
                            type="time"
                            value={h.break_start || ""}
                            onChange={(e) => update(d.key, { break_start: e.target.value || undefined })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Break end (optional)</Label>
                          <Input
                            type="time"
                            value={h.break_end || ""}
                            onChange={(e) => update(d.key, { break_end: e.target.value || undefined })}
                          />
                        </div>
                      </div>
                      {hasBreak && (
                        <p className="text-xs text-muted-foreground">
                          No bookings will be offered between {h.break_start} and {h.break_end}.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
