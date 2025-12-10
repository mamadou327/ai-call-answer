import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROTECTED_EMAILS = ["mlaye915@gmail.com", "cogclt4@gmail.com"];

interface Business {
  id: string;
  business_name: string;
  owner_id: string;
}

export const DangerZoneSection = () => {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cleanupMode, setCleanupMode] = useState<"all" | "specific">("specific");

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    const { data } = await supabase
      .from("businesses")
      .select("id, business_name, owner_id")
      .order("business_name");
    
    if (data) {
      setBusinesses(data);
    }
  };

  const handleWipeUsers = async () => {
    if (confirmText !== "DELETE") return;

    setIsDeleting(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("wipe-test-users", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: cleanupMode === "specific" && selectedBusinessId ? {
          businessId: selectedBusinessId
        } : undefined,
      });

      if (error) throw error;

      setResult(data);

      toast({
        title: "Cleanup Complete",
        description: cleanupMode === "specific" 
          ? `Cleaned up data for selected business.`
          : `Deleted ${data.deletedUsers} users, ${data.deletedBusinesses} businesses.`,
      });

      setShowConfirmDialog(false);
      setConfirmText("");
      setSelectedBusinessId("");
      loadBusinesses(); // Refresh list
    } catch (error: any) {
      console.error("Wipe error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform cleanup",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId);

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Data Cleanup (Danger Zone)
          </CardTitle>
          <CardDescription>
            Administrative actions that permanently delete data. Use with extreme caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cleanup Mode Selection */}
          <div className="space-y-3">
            <Label>Cleanup Mode</Label>
            <Select value={cleanupMode} onValueChange={(v) => setCleanupMode(v as "all" | "specific")}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border">
                <SelectItem value="specific">Specific Business</SelectItem>
                <SelectItem value="all">All Test Users (except protected)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cleanupMode === "specific" && (
            <div className="space-y-3">
              <Label>Select Business to Clean Up</Label>
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Choose a business..." />
                </SelectTrigger>
                <SelectContent className="bg-background border max-h-60">
                  {businesses.map((business) => (
                    <SelectItem key={business.id} value={business.id}>
                      {business.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedBusinessId && (
                <div className="p-4 bg-background border border-destructive/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>The business "{selectedBusiness?.business_name}"</li>
                    <li>All bookings for this business</li>
                    <li>All staff records and memberships</li>
                    <li>All services and opening hours</li>
                    <li>All call logs and messages</li>
                    <li>The owner's account (unless protected)</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {cleanupMode === "all" && (
            <div className="p-4 bg-background border border-destructive/20 rounded-lg">
              <h4 className="font-medium mb-2">Delete All Test Users</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This will permanently delete all user accounts and related data EXCEPT:
              </p>
              <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside space-y-1">
                {PROTECTED_EMAILS.map(email => (
                  <li key={email} className="font-mono">{email}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="destructive"
            onClick={() => setShowConfirmDialog(true)}
            disabled={cleanupMode === "specific" && !selectedBusinessId}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {cleanupMode === "specific" 
              ? "Delete Selected Business" 
              : "Delete All Users Except Main Admins"}
          </Button>

          {result && (
            <div className="p-4 bg-muted rounded-lg text-sm">
              <h4 className="font-medium mb-2">Last Cleanup Result:</h4>
              <ul className="space-y-1">
                {result.deletedUsers !== undefined && <li>Users deleted: {result.deletedUsers}</li>}
                {result.deletedBusinesses !== undefined && <li>Businesses deleted: {result.deletedBusinesses}</li>}
                {result.deletedMemberships !== undefined && <li>Staff memberships deleted: {result.deletedMemberships}</li>}
                {result.deletedProfiles !== undefined && <li>Profiles deleted: {result.deletedProfiles}</li>}
                {result.deletedRoles !== undefined && <li>User roles deleted: {result.deletedRoles}</li>}
                {result.deletedBookings !== undefined && <li>Bookings deleted: {result.deletedBookings}</li>}
                {result.deletedStaff !== undefined && <li>Staff deleted: {result.deletedStaff}</li>}
                {result.deletedServices !== undefined && <li>Services deleted: {result.deletedServices}</li>}
              </ul>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-destructive">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside">
                    {result.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Destructive Action
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {cleanupMode === "specific" ? (
                  <>
                    <p>
                      You are about to <strong className="text-destructive">permanently delete</strong> the business:
                    </p>
                    <p className="font-mono font-bold">{selectedBusiness?.business_name}</p>
                    <p>And all associated data including bookings, staff, services, and the owner account.</p>
                  </>
                ) : (
                  <>
                    <p>
                      You are about to <strong className="text-destructive">permanently delete</strong> all users and related data except:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {PROTECTED_EMAILS.map(email => (
                        <li key={email} className="font-mono">{email}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-destructive font-medium">
                  This action cannot be undone!
                </p>
                <div className="pt-2">
                  <Label htmlFor="confirm-delete">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="mt-2 font-mono"
                    disabled={isDeleting}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmText("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWipeUsers}
              disabled={confirmText !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {cleanupMode === "specific" ? "Delete Business" : "Delete All Test Users"}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};