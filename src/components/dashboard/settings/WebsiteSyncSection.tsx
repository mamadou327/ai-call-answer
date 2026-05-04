import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WebsiteImportDialog } from "@/components/dashboard/WebsiteImportDialog";

interface WebsiteSyncSectionProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const WebsiteSyncSection = ({ businessId, business, onUpdate }: WebsiteSyncSectionProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState<string>(business?.website || "");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const lastSynced = business?.website_last_synced_at
    ? new Date(business.website_last_synced_at).toLocaleString()
    : null;

  const handleSaveUrl = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ website: url.trim() || null })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Could not update URL", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Website URL updated." });
      onUpdate();
    }
  };

  return (
    <>
      <Card id="website-sync">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Website Sync
          </CardTitle>
          <CardDescription>
            Keep your services, hours and policies in sync with your website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last synced URL</span>
              <span className="font-medium truncate ml-4">{business?.website_last_synced_url || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last synced</span>
              <span className="font-medium">{lastSynced || "Never"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="sync-url"
                placeholder="https://yourbusiness.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button variant="outline" onClick={handleSaveUrl} disabled={saving || url === (business?.website || "")}>
                Save
              </Button>
            </div>
          </div>

          <Button onClick={() => setDialogOpen(true)} disabled={!url.trim()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-sync from website
          </Button>
        </CardContent>
      </Card>

      <WebsiteImportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        businessId={businessId}
        initialUrl={url}
        onComplete={onUpdate}
      />
    </>
  );
};
