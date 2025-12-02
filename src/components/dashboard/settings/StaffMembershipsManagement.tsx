import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserMinus, Clock, UserCheck, UserX, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StaffMembership {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  revoked_at: string | null;
  user_email?: string;
}

interface StaffMembershipsManagementProps {
  businessId: string;
  onUpdate: () => void;
}

export const StaffMembershipsManagement = ({ businessId, onUpdate }: StaffMembershipsManagementProps) => {
  const { toast } = useToast();
  const [memberships, setMemberships] = useState<StaffMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; membership: StaffMembership | null }>({
    open: false,
    membership: null,
  });

  useEffect(() => {
    loadMemberships();
  }, [businessId]);

  const loadMemberships = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_memberships")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get user emails from profiles
      const userIds = data?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.email]) || []);

      const enrichedData = data?.map(m => ({
        ...m,
        user_email: profileMap.get(m.user_id) || "Unknown",
      })) || [];

      setMemberships(enrichedData);
    } catch (error) {
      console.error("Error loading memberships:", error);
    } finally {
      setLoading(false);
    }
  };

  const approveMembership = async (membership: StaffMembership) => {
    setActionLoading(membership.id);
    try {
      const { error } = await supabase
        .from("staff_memberships")
        .update({
          status: "active",
          approved_at: new Date().toISOString(),
        })
        .eq("id", membership.id);

      if (error) throw error;

      toast({
        title: "Staff Approved",
        description: `${membership.user_email} now has access to the dashboard.`,
      });

      loadMemberships();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectMembership = async (membership: StaffMembership) => {
    setActionLoading(membership.id);
    try {
      const { error } = await supabase
        .from("staff_memberships")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("id", membership.id);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: `Access request from ${membership.user_email} has been rejected.`,
      });

      loadMemberships();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const revokeMembership = async () => {
    if (!revokeDialog.membership) return;
    
    setActionLoading(revokeDialog.membership.id);
    try {
      const { error } = await supabase
        .from("staff_memberships")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("id", revokeDialog.membership.id);

      if (error) throw error;

      toast({
        title: "Access Revoked",
        description: `${revokeDialog.membership.user_email} no longer has access.`,
      });

      setRevokeDialog({ open: false, membership: null });
      loadMemberships();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingMemberships = memberships.filter(m => m.status === "pending_approval");
  const activeMemberships = memberships.filter(m => m.status === "active");
  const revokedMemberships = memberships.filter(m => m.status === "revoked");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><UserCheck className="w-3 h-3 mr-1" />Active</Badge>;
      case "revoked":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><UserX className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-muted rounded"></div>
            <div className="h-12 w-full bg-muted rounded"></div>
            <div className="h-12 w-full bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Staff Access Requests</CardTitle>
          <CardDescription>
            Manage staff who have requested access using the join code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Approvals */}
          {pendingMemberships.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Pending Approval ({pendingMemberships.length})
              </h4>
              <div className="space-y-2">
                {pendingMemberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{membership.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          Requested {format(new Date(membership.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMembership(membership)}
                        disabled={actionLoading === membership.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMembership(membership)}
                        disabled={actionLoading === membership.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Staff */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Active Staff ({activeMemberships.length})
            </h4>
            {activeMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active staff members yet
              </p>
            ) : (
              <div className="space-y-2">
                {activeMemberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{membership.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          Approved {membership.approved_at ? format(new Date(membership.approved_at), "MMM d, yyyy") : "N/A"}
                        </p>
                      </div>
                      {getStatusBadge(membership.status)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setRevokeDialog({ open: true, membership })}
                      disabled={actionLoading === membership.id}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revoked Staff */}
          {revokedMemberships.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-muted-foreground">
                <UserX className="h-4 w-4" />
                Revoked ({revokedMemberships.length})
              </h4>
              <div className="space-y-2">
                {revokedMemberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{membership.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          Revoked {membership.revoked_at ? format(new Date(membership.revoked_at), "MMM d, yyyy") : "N/A"}
                        </p>
                      </div>
                      {getStatusBadge(membership.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, membership: revokeDialog.membership })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Staff Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for {revokeDialog.membership?.user_email}? 
              They will no longer be able to access the business dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revokeMembership} className="bg-red-600 hover:bg-red-700">
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};