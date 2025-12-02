import { useState } from "react";
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

const PROTECTED_EMAILS = ["mlaye915@gmail.com", "cogclt4@gmail.com"];

export const DangerZoneSection = () => {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<any>(null);

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
      });

      if (error) throw error;

      setResult(data);

      toast({
        title: "Cleanup Complete",
        description: `Deleted ${data.deletedUsers} users, ${data.deletedBusinesses} businesses, ${data.deletedMemberships} memberships.`,
      });

      setShowConfirmDialog(false);
      setConfirmText("");
    } catch (error: any) {
      console.error("Wipe error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to wipe test users",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
            <p className="text-sm text-destructive mb-4">
              This action cannot be undone. All businesses, staff memberships, profiles, and related data for deleted users will be removed.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowConfirmDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Users Except Main Admins
            </Button>
          </div>

          {result && (
            <div className="p-4 bg-muted rounded-lg text-sm">
              <h4 className="font-medium mb-2">Last Cleanup Result:</h4>
              <ul className="space-y-1">
                <li>Users deleted: {result.deletedUsers}</li>
                <li>Businesses deleted: {result.deletedBusinesses}</li>
                <li>Staff memberships deleted: {result.deletedMemberships}</li>
                <li>Profiles deleted: {result.deletedProfiles}</li>
                <li>User roles deleted: {result.deletedRoles}</li>
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
                <p>
                  You are about to <strong className="text-destructive">permanently delete</strong> all users and related data except:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {PROTECTED_EMAILS.map(email => (
                    <li key={email} className="font-mono">{email}</li>
                  ))}
                </ul>
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
                  Delete All Test Users
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
