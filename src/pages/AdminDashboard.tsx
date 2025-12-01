import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import aiviaLogo from "@/assets/aivia-logo.png";
import { LogOut, Clock, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Loader2 } from "lucide-react";

// Super admin email constant
const SUPER_ADMIN_EMAIL = "mlaye915@gmail.com";

interface Business {
  id: string;
  business_name: string;
  main_phone: string;
  address: string;
  website: string | null;
  staff_count: number;
  status: string;
  created_at: string;
  owner_id: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string | null;
  admin_status: string | null;
  admin_request_note: string | null;
  admin_requested_at: string | null;
  user_id: string;
}

interface AdminPermissions {
  can_approve_businesses: boolean;
  can_view_analytics: boolean;
  can_manage_billing: boolean;
  can_view_calls_messages: boolean;
}

interface PendingAdmin {
  user_id: string;
  email: string;
  profile: Profile;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<PendingAdmin | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissions>({
    can_approve_businesses: false,
    can_view_analytics: false,
    can_manage_billing: false,
    can_view_calls_messages: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"businesses" | "admins">("businesses");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const superAdmin = roles?.some(r => r.role === "super_admin");
    const subAdmin = roles?.some(r => r.role === "sub_admin");
    
    setIsSuperAdmin(!!superAdmin);

    if (!superAdmin && !subAdmin) {
      navigate("/admin");
      return;
    }

    // Load data based on role
    loadBusinesses();
    if (superAdmin) {
      loadPendingAdmins();
    }
  };

  const loadBusinesses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBusinesses(data || []);

      // Load profiles
      const ownerIds = [...new Set(data?.map(b => b.owner_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, admin_status, admin_request_note, admin_requested_at")
        .in("user_id", ownerIds);

      const profilesMap: Record<string, Profile> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = {
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          admin_status: p.admin_status,
          admin_request_note: p.admin_request_note,
          admin_requested_at: p.admin_requested_at,
          user_id: p.user_id,
        };
      });
      setProfiles(profilesMap);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingAdmins = async () => {
    try {
      // Query profiles directly for users with pending_admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "pending_admin");

      if (!roles || roles.length === 0) {
        setPendingAdmins([]);
        return;
      }

      const userIds = roles.map(r => r.user_id);

      // Get profiles with email from our database
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .eq("admin_status", "pending");

      if (error) throw error;

      // Build the pending admins list from profiles table
      // Filter out the super admin email
      const pendingList: PendingAdmin[] = (profilesData || [])
        .filter(profile => profile.email !== SUPER_ADMIN_EMAIL)
        .map(profile => ({
          user_id: profile.user_id,
          email: profile.email || "",
          profile: profile as Profile,
        }));

      setPendingAdmins(pendingList);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAdminAction = async (
    userId: string,
    action: "approve" | "reject"
  ) => {
    // Prevent modifying the super admin
    const admin = pendingAdmins.find(a => a.user_id === userId);
    if (admin?.email === SUPER_ADMIN_EMAIL) {
      toast({
        title: "Action Not Allowed",
        description: "The super admin account cannot be modified.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(userId);
    try {
      if (action === "approve") {
        // Change role from pending_admin to sub_admin
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: "sub_admin" })
          .eq("user_id", userId)
          .eq("role", "pending_admin");

        if (roleError) throw roleError;

        // Update admin status
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ admin_status: "active" })
          .eq("user_id", userId);

        if (profileError) throw profileError;

        // Create admin permissions
        const { error: permError } = await supabase
          .from("admin_permissions")
          .insert({
            user_id: userId,
            ...adminPermissions,
          });

        if (permError) throw permError;

        toast({
          title: "Admin Approved",
          description: "The admin has been approved and can now access the dashboard.",
        });
      } else {
        // Reject - delete role and update profile
        const { error: roleError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (roleError) throw roleError;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ admin_status: "rejected" })
          .eq("user_id", userId);

        if (profileError) throw profileError;

        toast({
          title: "Admin Rejected",
          description: "The admin request has been rejected.",
        });
      }

      loadPendingAdmins();
      setSelectedAdmin(null);
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

  const handleAction = async (businessId: string, newStatus: "approved" | "rejected") => {
    setActionLoading(businessId);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ status: newStatus })
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: `Business ${newStatus}`,
        description: `The business has been ${newStatus} successfully.`,
      });

      loadBusinesses();
      setSelectedBusiness(null);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-warning/10 text-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-success/10 text-success"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="text-xl font-bold">Aivia Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? "Manage businesses and administrators" : "Review and manage business applications"}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === "businesses" ? "default" : "outline"}
              onClick={() => setActiveTab("businesses")}
            >
              Business Applications
              {businesses.filter(b => b.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {businesses.filter(b => b.status === "pending").length}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "admins" ? "default" : "outline"}
              onClick={() => setActiveTab("admins")}
            >
              Admin Requests
              {pendingAdmins.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingAdmins.length}
                </Badge>
              )}
            </Button>
          </div>
        )}

        {activeTab === "businesses" && (
          <Card>
          <CardHeader>
            <CardTitle>Pending & Recent Applications</CardTitle>
            <CardDescription>Click on any business to view details and take action</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : businesses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No business applications yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Staff Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((business) => {
                    const profile = profiles[business.owner_id];
                    return (
                      <TableRow key={business.id}>
                        <TableCell className="font-medium">{business.business_name}</TableCell>
                        <TableCell>
                          {profile ? `${profile.first_name} ${profile.last_name}` : "N/A"}
                        </TableCell>
                        <TableCell>{business.main_phone}</TableCell>
                        <TableCell>{business.staff_count}</TableCell>
                        <TableCell>{getStatusBadge(business.status)}</TableCell>
                        <TableCell>{new Date(business.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedBusiness(business)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        )}

        {activeTab === "admins" && isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Admin Requests</CardTitle>
              <CardDescription>Review and approve administrator access requests</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingAdmins.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending admin requests</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAdmins.map((admin) => (
                      <TableRow key={admin.user_id}>
                        <TableCell className="font-medium">
                          {admin.profile.first_name} {admin.profile.last_name}
                        </TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>
                          {admin.profile.admin_requested_at
                            ? new Date(admin.profile.admin_requested_at).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAdmin(admin)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Business Details Dialog */}
      <Dialog open={!!selectedBusiness} onOpenChange={() => setSelectedBusiness(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBusiness?.business_name}</DialogTitle>
            <DialogDescription>Review business application details</DialogDescription>
          </DialogHeader>
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Owner</Label>
                  <p className="text-sm text-muted-foreground">
                    {profiles[selectedBusiness.owner_id]
                      ? `${profiles[selectedBusiness.owner_id].first_name} ${profiles[selectedBusiness.owner_id].last_name}`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Main Phone</Label>
                  <p className="text-sm text-muted-foreground">{selectedBusiness.main_phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Staff Count</Label>
                  <p className="text-sm text-muted-foreground">{selectedBusiness.staff_count}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedBusiness.status)}</div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Address</Label>
                <p className="text-sm text-muted-foreground">{selectedBusiness.address}</p>
              </div>
              {selectedBusiness.website && (
                <div>
                  <Label className="text-sm font-medium">Website</Label>
                  <p className="text-sm text-muted-foreground">{selectedBusiness.website}</p>
                </div>
              )}

              {selectedBusiness.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => handleAction(selectedBusiness.id, "approved")}
                    disabled={!!actionLoading}
                    className="flex-1"
                  >
                    {actionLoading === selectedBusiness.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction(selectedBusiness.id, "rejected")}
                    disabled={!!actionLoading}
                    className="flex-1"
                  >
                    {actionLoading === selectedBusiness.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Request Dialog */}
      <Dialog open={!!selectedAdmin} onOpenChange={() => setSelectedAdmin(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAdmin?.profile.first_name} {selectedAdmin?.profile.last_name}
            </DialogTitle>
            <DialogDescription>Review admin access request and set permissions</DialogDescription>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{selectedAdmin.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Requested</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAdmin.profile.admin_requested_at
                      ? new Date(selectedAdmin.profile.admin_requested_at).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedAdmin.profile.admin_request_note && (
                <div>
                  <Label className="text-sm font-medium">Reason for Request</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedAdmin.profile.admin_request_note}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium">Admin Permissions</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={adminPermissions.can_approve_businesses}
                      onChange={(e) =>
                        setAdminPermissions({
                          ...adminPermissions,
                          can_approve_businesses: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Can approve businesses</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={adminPermissions.can_view_analytics}
                      onChange={(e) =>
                        setAdminPermissions({
                          ...adminPermissions,
                          can_view_analytics: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Can view analytics</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={adminPermissions.can_manage_billing}
                      onChange={(e) =>
                        setAdminPermissions({
                          ...adminPermissions,
                          can_manage_billing: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Can manage billing</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={adminPermissions.can_view_calls_messages}
                      onChange={(e) =>
                        setAdminPermissions({
                          ...adminPermissions,
                          can_view_calls_messages: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Can view calls and messages</span>
                  </label>
                </div>
              </div>

               <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleAdminAction(selectedAdmin.user_id, "approve")}
                  disabled={!!actionLoading || selectedAdmin.email === SUPER_ADMIN_EMAIL}
                  className="flex-1"
                >
                  {actionLoading === selectedAdmin.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAdminAction(selectedAdmin.user_id, "reject")}
                  disabled={!!actionLoading || selectedAdmin.email === SUPER_ADMIN_EMAIL}
                  className="flex-1"
                >
                  {actionLoading === selectedAdmin.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
              {selectedAdmin.email === SUPER_ADMIN_EMAIL && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  This is the super admin account and cannot be modified.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Label = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
);

export default AdminDashboard;