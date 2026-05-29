import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AccountManagementSection = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-business-data`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `Aivia-Data-Export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = await res.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dl);
      toast({ title: "Export ready", description: "Your Excel file has been downloaded." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("delete-my-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { confirm: "DELETE" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently removed.",
      });
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "Deletion failed", description: e.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your data (GDPR)</CardTitle>
          <CardDescription>
            Download a copy of everything we store for your business, or permanently delete your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExport} disabled={exporting} variant="outline">
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Request data export
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Business-side export. Downloads an Excel file with separate tabs for your Business
            Profile, Clients, Bookings, Call Logs, Messages, Orders, Fallback Reservations,
            Missed Calls, Staff and Services. For an individual customer's GDPR data request,
            use the "Customer data request" card below.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete my account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and wipe every record we hold for your business. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently delete your account?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong className="text-destructive">permanently delete</strong> your
                  business, all bookings, customers, call logs, messages, staff records, menus
                  and settings.
                </p>
                <p className="text-destructive font-medium">This action cannot be undone.</p>
                <div className="pt-2">
                  <Label htmlFor="confirm-delete-acct">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    id="confirm-delete-acct"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="mt-2 font-mono"
                    disabled={deleting}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowConfirm(false); setConfirmText(""); }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || deleting}
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Delete account</>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
