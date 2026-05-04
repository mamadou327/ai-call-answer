import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WebsiteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  initialUrl?: string;
  onComplete?: () => void;
}

export const WebsiteImportDialog = ({ open, onOpenChange, businessId, initialUrl, onComplete }: WebsiteImportDialogProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState(initialUrl || "");
  const [scraping, setScraping] = useState(false);
  const [applying, setApplying] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [scrapedUrl, setScrapedUrl] = useState<string>("");

  const handleImport = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setExtracted(null);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: url.trim(), businessId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setExtracted((data as any).extracted);
      setScrapedUrl((data as any).url);
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: e?.message || "Could not read this website.",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  const handleConfirm = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-website-import", {
        body: { businessId, extracted, url: scrapedUrl, source: "manual" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Imported", description: "Your business details have been updated." });
      onComplete?.();
      handleClose();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "Could not apply imported data.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setExtracted(null);
    setScrapedUrl("");
    onOpenChange(false);
  };

  const renderPreview = () => {
    if (!extracted) return null;
    return (
      <div className="space-y-4 text-sm">
        {extracted.business_name && (
          <div>
            <div className="font-semibold">Business name</div>
            <div className="text-muted-foreground">{extracted.business_name}</div>
          </div>
        )}
        {Array.isArray(extracted.services) && extracted.services.length > 0 && (
          <div>
            <div className="font-semibold mb-1">Services ({extracted.services.length})</div>
            <ul className="text-muted-foreground space-y-1 max-h-40 overflow-y-auto pr-2">
              {extracted.services.slice(0, 30).map((s: any, i: number) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{s?.name}</span>
                  {s?.price != null && <span>{typeof s.price === "number" ? s.price : s.price}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {extracted.opening_hours && typeof extracted.opening_hours === "object" && (
          <div>
            <div className="font-semibold mb-1">Opening hours</div>
            <ul className="text-muted-foreground space-y-1">
              {Object.entries(extracted.opening_hours).map(([day, hrs]: any) => (
                <li key={day} className="flex justify-between gap-4">
                  <span className="capitalize">{day}</span>
                  <span>{String(hrs)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {extracted.cancellation_policy && (
          <div>
            <div className="font-semibold mb-1">Cancellation policy</div>
            <p className="text-muted-foreground line-clamp-4">{extracted.cancellation_policy}</p>
          </div>
        )}
        {extracted.booking_policy && (
          <div>
            <div className="font-semibold mb-1">Booking policy</div>
            <p className="text-muted-foreground line-clamp-4">{extracted.booking_policy}</p>
          </div>
        )}
        {Array.isArray(extracted.faqs) && extracted.faqs.length > 0 && (
          <div>
            <div className="font-semibold mb-1">FAQs ({extracted.faqs.length})</div>
            <ul className="text-muted-foreground text-xs space-y-1 max-h-32 overflow-y-auto pr-2">
              {extracted.faqs.slice(0, 10).map((f: any, i: number) => (
                <li key={i}><strong>{f?.question}</strong> — {f?.answer}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Import details from your website
          </DialogTitle>
          <DialogDescription>
            We'll read your homepage and a few key pages to pre-fill your services, hours and policies.
          </DialogDescription>
        </DialogHeader>

        {!extracted && (
          <div className="space-y-3">
            <Label htmlFor="website-url">Website URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="website-url"
                  placeholder="https://yourbusiness.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9"
                  disabled={scraping}
                />
              </div>
              <Button onClick={handleImport} disabled={scraping || !url.trim()}>
                {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This may take 10–30 seconds while we scan your site.
            </p>
          </div>
        )}

        {extracted && (
          <>
            <div className="border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
              {renderPreview()}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={applying}>Edit manually</Button>
              <Button onClick={handleConfirm} disabled={applying}>
                {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm and Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
