import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PROTECTED_EMAILS = ["mlaye915@gmail.com", "mo@aiviaapp.co.uk"];

interface UserItem {
  id: string;
  label: string;
  type: "business" | "user";
  email?: string;
}

export const DangerZoneSection = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cleanupMode, setCleanupMode] = useState<"all" | "specific">("specific");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    // Get all profiles (users)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .order("email");

    // Get all businesses
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, business_name, owner_id")
      .order("business_name");

    const items: UserItem[] = [];

    // Add businesses first
    (businesses || []).forEach((b) => {
      const profile = profiles?.find(p => p.user_id === b.owner_id);
      items.push({
        id: `business_${b.id}`,
        label: `🏢 ${b.business_name} (${profile?.email || 'unknown owner'})`,
        type: "business",
        email: profile?.email
      });
    });

    // Add standalone users (those without businesses)
    const businessOwnerIds = new Set((businesses || []).map(b => b.owner_id));
    (profiles || []).forEach((p) => {
      if (!businessOwnerIds.has(p.user_id) && !PROTECTED_EMAILS.includes(p.email || "")) {
        const name = p.first_name || p.last_name 
          ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
          : 'Unnamed';
        items.push({
          id: `user_${p.user_id}`,
          label: `👤 ${name} (${p.email})`,
          type: "user",
          email: p.email || undefined
        });
      }
    });

    setUsers(items);
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

      let body: any = undefined;
      
      if (cleanupMode === "specific" && selectedUserId) {
        const selectedItem = users.find(u => u.id === selectedUserId);
        if (selectedItem?.type === "business") {
          body = { businessId: selectedUserId.replace("business_", "") };
        } else if (selectedItem?.type === "user") {
          body = { userId: selectedUserId.replace("user_", "") };
        }
      }

      const { data, error } = await supabase.functions.invoke("wipe-test-users", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body,
      });

      if (error) throw error;

      setResult(data);

      toast({
        title: "Cleanup Complete",
        description: cleanupMode === "specific" 
          ? `Cleaned up selected account.`
          : `Deleted ${data.deletedUsers} users, ${data.deletedBusinesses} businesses.`,
      });

      setShowConfirmDialog(false);
      setConfirmText("");
      setSelectedUserId("");
      loadUsers();
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

  const selectedItem = users.find(u => u.id === selectedUserId);

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-destructive/50 bg-destructive/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-destructive/10 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Data Cleanup (Danger Zone)
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription>
                Administrative actions that permanently delete data. Click to expand.
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Cleanup Mode Selection */}
              <div className="space-y-3">
                <Label>Cleanup Mode</Label>
                <Select value={cleanupMode} onValueChange={(v) => setCleanupMode(v as "all" | "specific")}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border">
                    <SelectItem value="specific">Specific User/Business</SelectItem>
                    <SelectItem value="all">All Test Users (except protected)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cleanupMode === "specific" && (
                <div className="space-y-3">
                  <Label>Select Account to Clean Up</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose a user or business..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border max-h-60">
                      {users.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedUserId && selectedItem && (
                    <div className="p-4 bg-background border border-destructive/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-3">
                        This will permanently delete:
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        {selectedItem.type === "business" ? (
                          <>
                            <li>The business and owner account</li>
                            <li>All bookings for this business</li>
                            <li>All staff records and memberships</li>
                            <li>All services and opening hours</li>
                            <li>All call logs and messages</li>
                          </>
                        ) : (
                          <>
                            <li>The user account</li>
                            <li>All associated profiles and roles</li>
                            <li>All staff memberships</li>
                          </>
                        )}
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
                disabled={cleanupMode === "specific" && !selectedUserId}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {cleanupMode === "specific" 
                  ? "Delete Selected Account" 
                  : "Delete All Users Except Main Admin"}
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
          </CollapsibleContent>
        </Card>
      </Collapsible>


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
                      You are about to <strong className="text-destructive">permanently delete</strong>:
                    </p>
                    <p className="font-mono font-bold">{selectedItem?.label}</p>
                    <p>And all associated data.</p>
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
                  {cleanupMode === "specific" ? "Delete Account" : "Delete All Test Users"}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
