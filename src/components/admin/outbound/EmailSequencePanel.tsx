import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Loader2, Mail, Save, Send } from "lucide-react";

const DEFAULTS: Record<number, { subject: string; body_html: string; is_reply: boolean; delay_days: number }> = {
  1: {
    subject: "{{business_name}} calls",
    body_html: `<p>Hi {{first_name}},</p>
<p>I'm Mo, founder of Aivia. I've been looking at {{business_type}}s across London and something keeps coming up that I wanted to flag about {{business_name}}.</p>
<p>Most businesses like yours are losing bookings every week to competitors — not because the service is worse but because nobody picks up the phone when the team is busy. The caller just rings the next place.</p>
<p>I built something that fixes this completely. Worth a quick chat?</p>
<p>Mo<br/>Aivia — aiviaapp.co.uk</p>`,
    is_reply: false,
    delay_days: 0,
  },
  2: {
    subject: "",
    body_html: `<p>Hi {{first_name}},</p>
<p>Quick follow up. One thing I should mention — I built an AI receptionist that answers every call to a business sounding completely human. Most people cannot tell it is AI until they are told.</p>
<p>Happy to show you in 30 minutes how it would work for {{business_name}} specifically. Completely free, no commitment.</p>
<p>Worth a look?</p>
<p>Mo</p>`,
    is_reply: true,
    delay_days: 3,
  },
  3: {
    subject: "",
    body_html: `<p>Hi {{first_name}},</p>
<p>Last one from me on this.</p>
<p>If missed calls ever become a problem at {{business_name}} I am at mo@aiviaapp.co.uk or 07491 004439. Happy to show you how it works anytime.</p>
<p>No hard feelings either way.</p>
<p>Mo</p>`,
    is_reply: true,
    delay_days: 2,
  },
};

type Template = {
  id?: string;
  campaign_id: string;
  step_number: number;
  subject: string;
  body_html: string;
  is_reply: boolean;
  delay_days: number;
};

export function EmailSequencePanel({ campaignId, eligibleCounts }: { campaignId: string; eligibleCounts: Record<number, number> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Record<number, Template>>({});
  const [saving, setSaving] = useState(false);
  const [sendStep, setSendStep] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("outbound_email_templates")
      .select("*")
      .eq("campaign_id", campaignId);
    const map: Record<number, Template> = {};
    [1, 2, 3].forEach((n) => {
      const existing = (data || []).find((d: any) => d.step_number === n);
      map[n] = existing
        ? (existing as Template)
        : { campaign_id: campaignId, step_number: n, ...DEFAULTS[n] };
    });
    setTemplates(map);
  };
  useEffect(() => { load(); }, [campaignId]);

  const update = (n: number, patch: Partial<Template>) =>
    setTemplates((t) => ({ ...t, [n]: { ...t[n], ...patch } }));

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const n of [1, 2, 3]) {
        const t = templates[n];
        const payload = {
          campaign_id: campaignId,
          step_number: n,
          subject: t.subject || null,
          body_html: t.body_html,
          is_reply: !!t.is_reply,
          delay_days: t.delay_days ?? 0,
        };
        const { error } = await supabase
          .from("outbound_email_templates")
          .upsert(payload, { onConflict: "campaign_id,step_number" });
        if (error) throw error;
      }
      toast({ title: "Email templates saved" });
      load();
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendEmails = async () => {
    if (!sendStep) return;
    setSending(true);
    try {
      // Ensure templates are persisted before sending (defaults are client-side only until saved)
      const t = templates[sendStep];
      if (!t?.subject?.trim() || !t?.body_html?.trim()) {
        throw new Error(`Step ${sendStep} needs a subject and body. Save the template first.`);
      }
      await supabase
        .from("outbound_email_templates")
        .upsert(
          {
            campaign_id: campaignId,
            step_number: sendStep,
            subject: t.subject,
            body_html: t.body_html,
            is_reply: !!t.is_reply,
            delay_days: t.delay_days ?? 0,
          },
          { onConflict: "campaign_id,step_number" },
        );

      const { data, error } = await supabase.functions.invoke("send-outbound-emails", {
        body: { campaign_id: campaignId, step_number: sendStep },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      toast({ title: `Sent ${sent} emails for Step ${sendStep}` });
      setSendStep(null);
    } catch (e: any) {
      toast({ title: "Send failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Collapsible open={open} onOpenChange={setOpen} className="w-full">
          <div className="flex gap-2 items-center">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <Mail className="w-4 h-4 mr-1" />
                Email Sequence
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <Select value={sendStep ? String(sendStep) : ""} onValueChange={(v) => setSendStep(parseInt(v))}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Send step…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Send Step 1</SelectItem>
                <SelectItem value="2">Send Step 2</SelectItem>
                <SelectItem value="3">Send Step 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CollapsibleContent className="mt-3 space-y-4 border rounded-md p-4 bg-muted/30">
            {[1, 2, 3].map((n) => {
              const t = templates[n];
              if (!t) return null;
              return (
                <div key={n} className="space-y-2 border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Step {n}</h4>
                    <span className="text-xs text-muted-foreground">
                      Eligible: {eligibleCounts[n] ?? 0}
                    </span>
                  </div>
                  {n === 1 ? (
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Input
                        value={t.subject}
                        onChange={(e) => update(n, { subject: e.target.value })}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Subject: <code>Re: {templates[1]?.subject || "(Step 1 subject)"}</code>
                    </p>
                  )}
                  <div>
                    <Label className="text-xs">Body (HTML)</Label>
                    <Textarea
                      rows={6}
                      className="font-mono text-xs"
                      value={t.body_html}
                      onChange={(e) => update(n, { body_html: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variables: <code>{`{{first_name}}`}</code>, <code>{`{{business_name}}`}</code>, <code>{`{{business_type}}`}</code>
                    </p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Delay (days from previous)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8"
                        value={t.delay_days}
                        onChange={(e) => update(n, { delay_days: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={t.is_reply}
                        onCheckedChange={(v) => update(n, { is_reply: !!v })}
                      />
                      Reply to original thread
                    </label>
                  </div>
                </div>
              );
            })}
            <Button onClick={saveAll} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save templates
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Dialog open={!!sendStep} onOpenChange={(o) => !o && setSendStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Step {sendStep} emails</DialogTitle>
            <DialogDescription>
              Send Step {sendStep} emails to {eligibleCounts[sendStep || 1] ?? 0} leads who have not received this step yet?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendStep(null)} disabled={sending}>Cancel</Button>
            <Button onClick={sendEmails} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
