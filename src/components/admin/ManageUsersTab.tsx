import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, ChevronUp, Users, UserX, ShieldCheck, ShieldX, Eye, Building2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DangerZoneSection } from "./DangerZoneSection";
import { BusinessDetailsDialog } from "./BusinessDetailsDialog";
import { UserDetailsDialog } from "./UserDetailsDialog";

interface AppUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  is_active: boolean;
  role: string | null;
  business_name?: string | null;
  business_id?: string | null;
  phone?: string | null;
  position?: string | null;
}

interface BusinessDetails {
  id: string;
  business_name: string;
  owner_email: string | null;
  owner_name: string | null;
  main_phone: string;
  secondary_phone?: string | null;
  address: string;
  website?: string | null;
  status: string;
  created_at: string | null;
  staff_count: number;
  plan_tier?: string | null;
  aivia_active: boolean;
  assigned_aivia_number?: string | null;
}

// Protected admin emails that cannot be deactivated
const PROTECTED_EMAILS = ["mlaye915@gmail.com", "mo@aiviaapp.co.uk"];
// Admin emails for the Active Admins section
const ADMIN_EMAILS = ["mlaye915@gmail.com", "mo@aiviaapp.co.uk"];

interface PendingAdmin {
  user_id: string;
  email: string;
  profile: {
    first_name: string;
    last_name: string;
    email: string | null;
    admin_status: string | null;
    admin_request_note: string | null;
    admin_requested_at: string | null;
    user_id: string;
  };
}

interface ManageUsersTabProps {
  pendingAdmins?: PendingAdmin[];
  onAdminAction?: (userId: string, action: "approve" | "reject") => Promise<void>;
  setSelectedAdmin?: (admin: PendingAdmin | null) => void;
  actionLoading?: string | null;
}

export const ManageUsersTab = ({ 
  pendingAdmins = [], 
  onAdminAction,
  setSelectedAdmin,
  actionLoading 
}: ManageUsersTabProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ userId: string; newStatus: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessDetails | null>(null);
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name, created_at, admin_status");

      if (profilesError) throw profilesError;

      // Get all businesses to map owners
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, owner_id, business_name, main_phone, secondary_phone, address, website, status, created_at, staff_count, plan_tier, aivia_active, assigned_aivia_number");

      const businessMap = new Map(
        (businesses || []).map((b) => [b.owner_id, { name: b.business_name, id: b.id }])
      );

      // Get all user roles
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");

      const roleMap = new Map<string, string>();
      roles?.forEach((r) => {
        roleMap.set(r.user_id, r.role);
      });

      // Get staff memberships for staff details
      const { data: staffMemberships } = await supabase
        .from("staff_memberships")
        .select("user_id, phone, position, business_id, first_name, last_name");
      
      const staffMap = new Map<string, { phone: string | null; position: string | null; business_id: string }>();
      staffMemberships?.forEach((sm) => {
        staffMap.set(sm.user_id, { phone: sm.phone, position: sm.position, business_id: sm.business_id });
      });

      // Build user list
      const userList: AppUser[] = (profiles || []).map((p) => {
        const businessInfo = businessMap.get(p.user_id);
        const staffInfo = staffMap.get(p.user_id);
        const role = roleMap.get(p.user_id);
        
        // For staff members, get their business name from their membership
        let businessName = businessInfo?.name || null;
        let businessId = businessInfo?.id || null;
        
        if (!businessName && staffInfo?.business_id) {
          const staffBusiness = (businesses || []).find(b => b.id === staffInfo.business_id);
          businessName = staffBusiness?.business_name || null;
          businessId = staffInfo.business_id;
        }
        
        return {
          user_id: p.user_id,
          email: p.email || "",
          first_name: p.first_name,
          last_name: p.last_name,
          created_at: p.created_at,
          is_active: p.admin_status !== "inactive",
          role: role || (staffInfo ? "staff" : "business_owner"),
          business_name: businessName,
          business_id: businessId,
          phone: staffInfo?.phone || null,
          position: staffInfo?.position || null,
        };
      });

      // Store businesses for detail lookup
      (window as any).__businessesData = businesses;

      setUsers(userList);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleClick = (userId: string, currentStatus: boolean) => {
    const user = users.find((u) => u.user_id === userId);
    if (user && PROTECTED_EMAILS.includes(user.email)) {
      toast({
        title: "Action Not Allowed",
        description: "This admin account cannot be deactivated.",
        variant: "destructive",
      });
      return;
    }

    setPendingAction({ userId, newStatus: !currentStatus });
    setShowPasswordDialog(true);
  };

  const verifyPasswordAndToggle = async () => {
    if (!pendingAction || !password) return;

    setIsVerifying(true);
    try {
      // Get current user email
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not authenticated");

      // Re-authenticate with password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInError) {
        toast({
          title: "Invalid Password",
          description: "The password you entered is incorrect.",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Update the user status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ admin_status: pendingAction.newStatus ? "active" : "inactive" })
        .eq("user_id", pendingAction.userId);

      if (updateError) throw updateError;

      toast({
        title: pendingAction.newStatus ? "User Activated" : "User Deactivated",
        description: `The user account has been ${pendingAction.newStatus ? "activated" : "deactivated"}.`,
      });

      loadUsers();
      setShowPasswordDialog(false);
      setPassword("");
      setPendingAction(null);
    } catch (error: any) {
      console.error("Toggle error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Separate admin users from regular users
  const adminUsers = users.filter((u) => ADMIN_EMAILS.includes(u.email.toLowerCase()));
  const activeUsers = users.filter((u) => u.is_active && !ADMIN_EMAILS.includes(u.email.toLowerCase()));
  const inactiveUsers = users.filter((u) => !u.is_active);

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-primary/10 text-primary">Super Admin</Badge>;
      case "sub_admin":
        return <Badge className="bg-blue-500/10 text-blue-500">Sub Admin</Badge>;
      case "staff":
        return <Badge variant="secondary">Staff</Badge>;
      default:
        return <Badge variant="outline">Business Owner</Badge>;
    }
  };

  const viewBusinessDetails = async (businessId: string, user: AppUser) => {
    const businessesData = (window as any).__businessesData || [];
    const business = businessesData.find((b: any) => b.id === businessId);
    
    if (business) {
      setSelectedBusiness({
        id: business.id,
        business_name: business.business_name,
        owner_email: user.email,
        owner_name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.first_name || user.last_name || null,
        main_phone: business.main_phone,
        secondary_phone: business.secondary_phone,
        address: business.address,
        website: business.website,
        status: business.status,
        created_at: business.created_at,
        staff_count: business.staff_count,
        plan_tier: business.plan_tier,
        aivia_active: business.aivia_active,
        assigned_aivia_number: business.assigned_aivia_number,
      });
      setShowBusinessDialog(true);
    }
  };

  const viewUserDetails = (user: AppUser) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  const UserTable = ({ userList, showToggle = true }: { userList: AppUser[]; showToggle?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Business</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          {showToggle && <TableHead className="text-right">Status</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.map((user) => {
          const isProtected = PROTECTED_EMAILS.includes(user.email);
          return (
            <TableRow key={user.user_id}>
              <TableCell className="font-medium">
                <button
                  onClick={() => viewUserDetails(user)}
                  className="flex items-center gap-2 text-foreground hover:text-primary cursor-pointer"
                >
                  {user.first_name || user.last_name
                    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                    : "—"}
                  <Eye className="w-3 h-3 opacity-50" />
                </button>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                {user.business_name ? (
                  <button
                    onClick={() => user.business_id && viewBusinessDetails(user.business_id, user)}
                    className="flex items-center gap-2 text-primary hover:underline cursor-pointer"
                  >
                    <Building2 className="w-3 h-3" />
                    {user.business_name}
                  </button>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              <TableCell>
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "—"}
              </TableCell>
              {showToggle && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isProtected && (
                      <ShieldCheck className="w-4 h-4 text-primary" aria-label="Protected account" />
                    )}
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={() => handleToggleClick(user.user_id, user.is_active)}
                      disabled={isProtected}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      {/* Pending Admin Requests */}
      {pendingAdmins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-warning" />
              Pending Admin Requests
              <Badge variant="secondary">{pendingAdmins.length}</Badge>
            </CardTitle>
            <CardDescription>
              Review and approve administrator access requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAdmin?.(admin)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Active Admins - Collapsible */}
      {adminUsers.length > 0 && (
        <Collapsible open={showAdmins} onOpenChange={setShowAdmins}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Active Admins
                    <Badge className="bg-primary/10 text-primary">{adminUsers.length}</Badge>
                  </div>
                  {showAdmins ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardTitle>
                <CardDescription>
                  Admin accounts with full platform access
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <UserTable userList={adminUsers} showToggle={false} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Active Users
          </CardTitle>
          <CardDescription>
            All active users on the platform. Toggle to deactivate accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No active users</p>
          ) : (
            <UserTable userList={activeUsers} />
          )}
        </CardContent>
      </Card>

      {/* Inactive Users Collapsible */}
      {inactiveUsers.length > 0 && (
        <Collapsible open={showInactive} onOpenChange={setShowInactive}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserX className="w-5 h-5 text-muted-foreground" />
                    Inactive Users
                    <Badge variant="secondary">{inactiveUsers.length}</Badge>
                  </div>
                  {showInactive ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <UserTable userList={inactiveUsers} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Danger Zone */}
      <DangerZoneSection />

      {/* Password Confirmation Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingAction?.newStatus ? (
                <ShieldCheck className="w-5 h-5 text-success" />
              ) : (
                <ShieldX className="w-5 h-5 text-destructive" />
              )}
              Confirm {pendingAction?.newStatus ? "Activation" : "Deactivation"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Enter your password to {pendingAction?.newStatus ? "activate" : "deactivate"} this user account.
                </p>
                <div>
                  <Label htmlFor="admin-password">Your Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="mt-2"
                    disabled={isVerifying}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPassword("");
                setPendingAction(null);
              }}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction?.newStatus ? "default" : "destructive"}
              onClick={verifyPasswordAndToggle}
              disabled={!password || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                `Confirm ${pendingAction?.newStatus ? "Activation" : "Deactivation"}`
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Business Details Dialog */}
      <BusinessDetailsDialog 
        business={selectedBusiness} 
        open={showBusinessDialog} 
        onOpenChange={setShowBusinessDialog} 
      />

      {/* User Details Dialog */}
      <UserDetailsDialog
        user={selectedUser}
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
      />
    </div>
  );
};
