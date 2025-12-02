import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserMinus, Clock, UserCheck, UserX, Mail, Phone, Briefcase, Armchair, Eye } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffMembership {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  revoked_at: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  position: string | null;
  chair: string | null;
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
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; membership: StaffMembership | null }>({
    open: false,
    membership: null,
  });
  const [activeTab, setActiveTab] = useState("pending");

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
        description: `${getDisplayName(membership)} now has access to the dashboard.`,
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
        description: `Access request from ${getDisplayName(membership)} has been rejected.`,
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
        description: `${getDisplayName(revokeDialog.membership)} no longer has access.`,
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

  const getDisplayName = (membership: StaffMembership) => {
    if (membership.first_name || membership.last_name) {
      return `${membership.first_name || ""} ${membership.last_name || ""}`.trim();
    }
    return membership.user_email || "Unknown";
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

  const StaffDetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-medium">{value}</p>
        </div>
      </div>
    );
  };

  const renderStaffCard = (membership: StaffMembership, showActions: "pending" | "active" | "revoked") => (
    <div
      key={membership.id}
      className={`p-4 border rounded-lg ${
        showActions === "pending" ? "bg-amber-50/50" : 
        showActions === "revoked" ? "bg-muted/30" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold">{getDisplayName(membership)}</p>
            {getStatusBadge(membership.status)}
          </div>
          <p className="text-sm text-muted-foreground">{membership.user_email}</p>
          
          {/* Show profile details */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {membership.position && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                {membership.position}
              </span>
            )}
            {membership.phone && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {membership.phone}
              </span>
            )}
            {membership.chair && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Armchair className="h-3 w-3" />
                {membership.chair}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {showActions === "pending" && `Requested ${format(new Date(membership.created_at), "MMM d, yyyy 'at' h:mm a")}`}
            {showActions === "active" && membership.approved_at && `Approved ${format(new Date(membership.approved_at), "MMM d, yyyy")}`}
            {showActions === "revoked" && membership.revoked_at && `Revoked ${format(new Date(membership.revoked_at), "MMM d, yyyy")}`}
          </p>
        </div>
        
        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDetailDialog({ open: true, membership })}
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          {showActions === "pending" && (
            <>
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
            </>
          )}
          
          {showActions === "active" && (
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
          )}
        </div>
      </div>
    </div>
  );

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
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingMemberships.length > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {pendingMemberships.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">
                Active
                {activeMemberships.length > 0 && (
                  <span className="ml-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {activeMemberships.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="revoked">
                Revoked
                {revokedMemberships.length > 0 && (
                  <span className="ml-2 bg-muted-foreground text-white text-xs px-1.5 py-0.5 rounded-full">
                    {revokedMemberships.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {pendingMemberships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                pendingMemberships.map((m) => renderStaffCard(m, "pending"))
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-3">
              {activeMemberships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No active staff members</p>
                </div>
              ) : (
                activeMemberships.map((m) => renderStaffCard(m, "active"))
              )}
            </TabsContent>

            <TabsContent value="revoked" className="space-y-3">
              {revokedMemberships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No revoked staff</p>
                </div>
              ) : (
                revokedMemberships.map((m) => renderStaffCard(m, "revoked"))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog({ open, membership: revokeDialog.membership })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Staff Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for {revokeDialog.membership && getDisplayName(revokeDialog.membership)}? 
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

      {/* Staff Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, membership: detailDialog.membership })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
            <DialogDescription>
              Full profile information for this staff member
            </DialogDescription>
          </DialogHeader>
          
          {detailDialog.membership && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">
                    {(detailDialog.membership.first_name?.[0] || detailDialog.membership.user_email?.[0] || "?").toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{getDisplayName(detailDialog.membership)}</p>
                  {getStatusBadge(detailDialog.membership.status)}
                </div>
              </div>

              <div className="border-t pt-3 space-y-1">
                <StaffDetailRow icon={Mail} label="Email" value={detailDialog.membership.user_email} />
                <StaffDetailRow icon={Phone} label="Contact Number" value={detailDialog.membership.phone} />
                <StaffDetailRow icon={Briefcase} label="Position" value={detailDialog.membership.position} />
                <StaffDetailRow icon={Armchair} label="Chair/Station" value={detailDialog.membership.chair} />
              </div>

              <div className="border-t pt-3 mt-3 text-sm text-muted-foreground space-y-1">
                <p>Requested: {format(new Date(detailDialog.membership.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                {detailDialog.membership.approved_at && (
                  <p>Approved: {format(new Date(detailDialog.membership.approved_at), "MMM d, yyyy 'at' h:mm a")}</p>
                )}
                {detailDialog.membership.revoked_at && (
                  <p className="text-red-600">Revoked: {format(new Date(detailDialog.membership.revoked_at), "MMM d, yyyy 'at' h:mm a")}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};