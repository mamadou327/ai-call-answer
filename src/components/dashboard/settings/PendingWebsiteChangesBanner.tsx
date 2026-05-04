import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingWebsiteChangesBannerProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const PendingWebsiteChangesBanner = ({ businessId, business, onUpdate }: PendingWebsiteChangesBannerProps) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const pending = business?.website_pending_changes;
  if (!pending || !pending.changes) return null;

  const changes: Record<string, { old: any; new: any }> = pending.changes;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-website-import", {
        body: {
          businessId,
          extracted: pending.extracted,
          url: business?.website_last_synced_url || business?.website,
          source: "weekly",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Changes applied", description: "Your details have been updated." });
      onUpdate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Could not apply changes", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({ website_pending_changes: null })
      .eq("id", businessId);
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: "Could not dismiss", variant: "destructive" });
    } else {
      toast({ title: "Dismissed", description: "Changes ignored." });
      onUpdate();
    }
  };

  const renderValue = (v: any) => {
    if (v == null) return <span className="text-muted-foreground italic">empty</span>;
    if (typeof v === "string") return <span className="text-sm">{v}</span>;
    return (
      <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 p-2 rounded max-h-40 overflow-y-auto">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5" />
          Your website may have changed — review and confirm your updated details.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {Object.entries(changes).map(([field, { old, new: nw }]) => (
            <div key={field} className="border rounded-lg p-3 bg-background">
              <div className="font-semibold capitalize mb-2">{field.replace(/_/g, " ")}</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Currently</div>
                  {renderValue(old)}
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Found on website</div>
                  {renderValue(nw)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleDismiss} disabled={busy}>Dismiss</Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm Updates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
