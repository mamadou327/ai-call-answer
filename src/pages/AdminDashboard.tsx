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
import { LogOut, Clock, CheckCircle2, XCircle, Eye, Globe, ChevronRight, ChevronLeft, Phone, Copy, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlobeActivityTracker } from "@/components/admin/GlobeActivityTracker";
import { AdminAnalyticsDashboard } from "@/components/admin/AdminAnalyticsDashboard";
import { ManageUsersTab } from "@/components/admin/ManageUsersTab";
import { AiviaAssistantChat } from "@/components/AiviaAssistantChat";
import { LayoutDashboard, Settings2 } from "lucide-react";

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
  assigned_aivia_number: string | null;
  number_notes: string | null;
  porting_status: string | null;
  porting_instructions: string | null;
  // Twilio fields
  twilio_webhook_token: string | null;
  twilio_phone_number: string | null;
  twilio_enabled: boolean | null;
  aivia_active: boolean;
  // MessageBird fields
  messagebird_phone_number: string | null;
  messagebird_token: string | null;
  messagebird_enabled: boolean;
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
  can_manage_business_numbers: boolean;
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
  const [dialogStep, setDialogStep] = useState<1 | 2 | 3>(1);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<PendingAdmin | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissions>({
    can_approve_businesses: false,
    can_manage_business_numbers: false,
    can_view_analytics: false,
    can_manage_billing: false,
    can_view_calls_messages: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analytics" | "businesses" | "approved" | "admins" | "tracker" | "users">("analytics");
  const [userPermissions, setUserPermissions] = useState<AdminPermissions>({
    can_approve_businesses: false,
    can_manage_business_numbers: false,
    can_view_analytics: false,
    can_manage_billing: false,
    can_view_calls_messages: false,
  });
  
  // Business number assignment state
  const [assignedNumber, setAssignedNumber] = useState("");
  const [numberNotes, setNumberNotes] = useState("");
  const [portingStatus, setPortingStatus] = useState<string>("pending");
  const [portingInstructions, setPortingInstructions] = useState("");
  
  // Twilio settings state
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [twilioWebhookToken, setTwilioWebhookToken] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  
  // MessageBird settings state
  const [messagebirdPhoneNumber, setMessagebirdPhoneNumber] = useState("");
  const [messagebirdEnabled, setMessagebirdEnabled] = useState(false);
  const [messagebirdToken, setMessagebirdToken] = useState<string | null>(null);
  const [copiedMessagebirdWebhook, setCopiedMessagebirdWebhook] = useState(false);
  
  // Supabase project ID for webhook URL
  const SUPABASE_PROJECT_ID = "zyqzypyncugihrawhppg";

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const superAdmin = roles?.some(r => r.role === "super_admin");
    const subAdmin = roles?.some(r => r.role === "sub_admin");
    
    setIsSuperAdmin(!!superAdmin);
    setCurrentUserId(user.id);

    if (!superAdmin && !subAdmin) {
      navigate("/admin/login");
      return;
    }

    // Load user's permissions
    if (subAdmin) {
      const { data: perms } = await supabase
        .from("admin_permissions")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (perms) {
        setUserPermissions({
          can_approve_businesses: perms.can_approve_businesses || false,
          can_manage_business_numbers: perms.can_manage_business_numbers || false,
          can_view_analytics: perms.can_view_analytics || false,
          can_manage_billing: perms.can_manage_billing || false,
          can_view_calls_messages: perms.can_view_calls_messages || false,
        });
      }
    } else if (superAdmin) {
      // Super admin has all permissions
      setUserPermissions({
        can_approve_businesses: true,
        can_manage_business_numbers: true,
        can_view_analytics: true,
        can_manage_billing: true,
        can_view_calls_messages: true,
      });
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

  const handleAction = async (businessId: string, newStatus: "approved" | "rejected" | "revoked") => {
    setActionLoading(businessId);
    try {
      const business = businesses.find(b => b.id === businessId);
      const profile = business ? profiles[business.owner_id] : null;
      
      const updateData: any = { status: newStatus };
      
      // If approving, include number assignment and porting details
      if (newStatus === "approved") {
        if (assignedNumber) updateData.assigned_aivia_number = assignedNumber;
        if (numberNotes) updateData.number_notes = numberNotes;
        if (portingStatus) updateData.porting_status = portingStatus;
        if (portingInstructions) updateData.porting_instructions = portingInstructions;
      }

      const { error } = await supabase
        .from("businesses")
        .update(updateData)
        .eq("id", businessId);

      if (error) throw error;

      // If approving a business, send approval email to the business owner
      if (newStatus === "approved" && business && profile?.email) {
        try {
          console.log("Sending business approval email to:", profile.email);
          
          const dashboardUrl = "https://d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com/dashboard";
          
          const { error: emailError } = await supabase.functions.invoke("send-business-approval-email", {
            body: {
              businessName: business.business_name,
              ownerEmail: profile.email,
              dashboardUrl: dashboardUrl,
              assignedNumber: assignedNumber || business.assigned_aivia_number || undefined,
              portingStatus: portingStatus || business.porting_status || undefined,
            },
          });

          if (emailError) {
            console.error("Failed to send business approval email:", emailError);
          } else {
            console.log("Business approval email sent successfully");
          }
        } catch (emailError) {
          console.error("Error sending business approval email:", emailError);
        }
      }

      toast({
        title: `Business ${newStatus}`,
        description: `The business has been ${newStatus} successfully.`,
      });

      loadBusinesses();
      setSelectedBusiness(null);
      setDialogStep(1);
      // Reset form fields
      setAssignedNumber("");
      setNumberNotes("");
      setPortingStatus("pending");
      setPortingInstructions("");
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

  const handleUpdateApprovedBusiness = async (businessId: string) => {
    setActionLoading(businessId);
    try {
      const updateData: any = {};
      
      if (assignedNumber !== undefined) updateData.assigned_aivia_number = assignedNumber || null;
      if (numberNotes !== undefined) updateData.number_notes = numberNotes || null;
      if (portingStatus) updateData.porting_status = portingStatus;
      if (portingInstructions !== undefined) updateData.porting_instructions = portingInstructions || null;
      
      // Twilio fields
      updateData.twilio_phone_number = twilioPhoneNumber || null;
      updateData.twilio_enabled = twilioEnabled;
      
      // If enabling Twilio and we have a new token, save it
      if (twilioEnabled && twilioWebhookToken) {
        updateData.twilio_webhook_token = twilioWebhookToken;
      }

      // MessageBird fields
      updateData.messagebird_phone_number = messagebirdPhoneNumber || null;
      updateData.messagebird_enabled = messagebirdEnabled;
      
      // If enabling MessageBird and we have a new token, save it
      if (messagebirdEnabled && messagebirdToken) {
        updateData.messagebird_token = messagebirdToken;
      }

      const { error } = await supabase
        .from("businesses")
        .update(updateData)
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Business Updated",
        description: "The business details have been updated successfully.",
      });

      loadBusinesses();
      setSelectedBusiness(null);
      setDialogStep(1);
      setAssignedNumber("");
      setNumberNotes("");
      setPortingStatus("pending");
      setPortingInstructions("");
      setTwilioPhoneNumber("");
      setTwilioEnabled(false);
      setTwilioWebhookToken(null);
      setMessagebirdPhoneNumber("");
      setMessagebirdEnabled(false);
      setMessagebirdToken(null);
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
      case "revoked":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const openBusinessDialog = (business: Business) => {
    setSelectedBusiness(business);
    setDialogStep(1);
    // Pre-fill existing values if any
    setAssignedNumber(business.assigned_aivia_number || "");
    setNumberNotes(business.number_notes || "");
    setPortingStatus(business.porting_status || "pending");
    setPortingInstructions(business.porting_instructions || "");
    // Pre-fill Twilio values
    setTwilioPhoneNumber(business.twilio_phone_number || "");
    setTwilioEnabled(business.twilio_enabled || false);
    setTwilioWebhookToken(business.twilio_webhook_token || null);
    setCopiedWebhook(false);
    // Pre-fill MessageBird values
    setMessagebirdPhoneNumber(business.messagebird_phone_number || "");
    setMessagebirdEnabled(business.messagebird_enabled || false);
    setMessagebirdToken(business.messagebird_token || null);
    setCopiedMessagebirdWebhook(false);
  };

  const closeBusinessDialog = () => {
    setSelectedBusiness(null);
    setDialogStep(1);
    setAssignedNumber("");
    setNumberNotes("");
    setPortingStatus("pending");
    setPortingInstructions("");
    // Reset Twilio state
    setTwilioPhoneNumber("");
    setTwilioEnabled(false);
    setTwilioWebhookToken(null);
    setCopiedWebhook(false);
    // Reset MessageBird state
    setMessagebirdPhoneNumber("");
    setMessagebirdEnabled(false);
    setMessagebirdToken(null);
    setCopiedMessagebirdWebhook(false);
  };

  const handleTwilioToggle = async (enabled: boolean) => {
    if (!selectedBusiness) return;
    
    setTwilioEnabled(enabled);
    
    // If enabling and no token exists, generate one
    if (enabled && !twilioWebhookToken) {
      const newToken = crypto.randomUUID();
      setTwilioWebhookToken(newToken);
    }
  };

  const copyWebhookUrl = () => {
    if (!twilioWebhookToken) return;
    const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook/${twilioWebhookToken}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const getWebhookUrl = () => {
    if (!twilioWebhookToken) return "";
    return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook/${twilioWebhookToken}`;
  };

  const handleMessagebirdToggle = async (enabled: boolean) => {
    if (!selectedBusiness) return;
    
    setMessagebirdEnabled(enabled);
    
    // If enabling and no token exists, generate one
    if (enabled && !messagebirdToken) {
      const newToken = crypto.randomUUID();
      setMessagebirdToken(newToken);
    }
  };

  const copyMessagebirdWebhookUrl = () => {
    if (!messagebirdToken) return;
    const webhookUrl = `https://aiviaapp.co.uk/api/messagebird/voice/${messagebirdToken}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedMessagebirdWebhook(true);
    setTimeout(() => setCopiedMessagebirdWebhook(false), 2000);
    toast({
      title: "Copied",
      description: "MessageBird webhook URL copied to clipboard",
    });
  };

  const getMessagebirdWebhookUrl = () => {
    if (!messagebirdToken) return "";
    return `https://aiviaapp.co.uk/api/messagebird/voice/${messagebirdToken}`;
  };

  // Filter businesses by status
  const pendingAndRecentBusinesses = businesses.filter(b => b.status === "pending" || b.status === "rejected" || b.status === "revoked");
  const approvedBusinesses = businesses.filter(b => b.status === "approved");

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

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => setActiveTab("analytics")}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant={activeTab === "businesses" ? "default" : "outline"}
            onClick={() => setActiveTab("businesses")}
          >
            Pending Applications
            {pendingAndRecentBusinesses.filter(b => b.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingAndRecentBusinesses.filter(b => b.status === "pending").length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "approved" ? "default" : "outline"}
            onClick={() => setActiveTab("approved")}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approved Businesses
            {approvedBusinesses.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {approvedBusinesses.length}
              </Badge>
            )}
          </Button>
          {isSuperAdmin && (
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
          )}
          {(isSuperAdmin || userPermissions.can_view_analytics) && (
            <Button
              variant={activeTab === "tracker" ? "default" : "outline"}
              onClick={() => setActiveTab("tracker")}
            >
              <Globe className="w-4 h-4 mr-2" />
              World Tracker
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              onClick={() => setActiveTab("users")}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Manage Users
            </Button>
          )}
        </div>

        {activeTab === "analytics" && (
          <AdminAnalyticsDashboard />
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
              ) : pendingAndRecentBusinesses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending business applications</p>
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
                    {pendingAndRecentBusinesses.map((business) => {
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
                              onClick={() => openBusinessDialog(business)}
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

        {activeTab === "approved" && (
          <Card>
            <CardHeader>
              <CardTitle>Approved Businesses</CardTitle>
              <CardDescription>All businesses that have been approved</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : approvedBusinesses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No approved businesses yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Aivia Number</TableHead>
                      <TableHead>Staff Count</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedBusinesses.map((business) => {
                      const profile = profiles[business.owner_id];
                      return (
                        <TableRow key={business.id}>
                          <TableCell className="font-medium">{business.business_name}</TableCell>
                          <TableCell>
                            {profile ? `${profile.first_name} ${profile.last_name}` : "N/A"}
                          </TableCell>
                          <TableCell>{business.main_phone}</TableCell>
                          <TableCell>{business.assigned_aivia_number || "—"}</TableCell>
                          <TableCell>{business.staff_count}</TableCell>
                          <TableCell>{new Date(business.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openBusinessDialog(business)}
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

        {activeTab === "tracker" && (
          <GlobeActivityTracker />
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

        {activeTab === "users" && isSuperAdmin && (
          <ManageUsersTab />
        )}
      </div>

      {/* Business Details Dialog - Multi-step */}
      <Dialog open={!!selectedBusiness} onOpenChange={closeBusinessDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBusiness?.business_name}</DialogTitle>
          <DialogDescription>
              {dialogStep === 1 ? "Business details" : dialogStep === 2 ? "Number assignment & porting" : "Twilio & MessageBird"}
            </DialogDescription>
          </DialogHeader>
          {selectedBusiness && (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 pb-2">
                <div className={`w-2 h-2 rounded-full ${dialogStep === 1 ? "bg-primary" : "bg-muted"}`} />
                <div className={`w-2 h-2 rounded-full ${dialogStep === 2 ? "bg-primary" : "bg-muted"}`} />
                <div className={`w-2 h-2 rounded-full ${dialogStep === 3 ? "bg-primary" : "bg-muted"}`} />
              </div>

              {/* Step 1: Business Details */}
              {dialogStep === 1 && (
                <>
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
                      <Label className="text-sm font-medium">Owner Email</Label>
                      <p className="text-sm text-muted-foreground">
                        {profiles[selectedBusiness.owner_id]?.email || "N/A"}
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
                    <div>
                      <Label className="text-sm font-medium">Applied</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedBusiness.created_at).toLocaleDateString()}
                      </p>
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
                  {selectedBusiness.assigned_aivia_number && (
                    <div>
                      <Label className="text-sm font-medium">Assigned Aivia Number</Label>
                      <p className="text-sm text-muted-foreground">{selectedBusiness.assigned_aivia_number}</p>
                    </div>
                  )}
                  {selectedBusiness.porting_status && (
                    <div>
                      <Label className="text-sm font-medium">Porting Status</Label>
                      <p className="text-sm text-muted-foreground capitalize">
                        {selectedBusiness.porting_status.replace("_", " ")}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button onClick={() => setDialogStep(2)}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Actions */}
              {dialogStep === 2 && (
                <>
                  {selectedBusiness.status === "pending" && userPermissions.can_approve_businesses && (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Number Assignment & Porting</h3>
                        
                        <div>
                          <Label htmlFor="assigned-number" className="text-sm font-medium">
                            Assigned Aivia Number
                          </Label>
                          <Input
                            id="assigned-number"
                            placeholder="+1 (555) 123-4567"
                            value={assignedNumber}
                            onChange={(e) => setAssignedNumber(e.target.value)}
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            If providing an Aivia number
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="number-notes" className="text-sm font-medium">
                            Number Notes
                          </Label>
                          <Textarea
                            id="number-notes"
                            placeholder="Optional notes about the number assignment..."
                            value={numberNotes}
                            onChange={(e) => setNumberNotes(e.target.value)}
                            className="mt-1.5"
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label htmlFor="porting-status" className="text-sm font-medium">
                            Porting Status
                          </Label>
                          <Select value={portingStatus} onValueChange={setPortingStatus}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_porting">Not Porting</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Select "Not Porting" if using an Aivia number only
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="porting-instructions" className="text-sm font-medium">
                            Porting Instructions
                          </Label>
                          <Textarea
                            id="porting-instructions"
                            placeholder="Detailed instructions for number porting..."
                            value={portingInstructions}
                            onChange={(e) => setPortingInstructions(e.target.value)}
                            className="mt-1.5"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setDialogStep(1)}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
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
                    </>
                  )}

                  {selectedBusiness.status === "approved" && userPermissions.can_approve_businesses && (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Edit Number Assignment & Porting</h3>
                        
                        <div>
                          <Label htmlFor="edit-assigned-number" className="text-sm font-medium">
                            Assigned Aivia Number
                          </Label>
                          <Input
                            id="edit-assigned-number"
                            placeholder="+1 (555) 123-4567"
                            value={assignedNumber}
                            onChange={(e) => setAssignedNumber(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="edit-number-notes" className="text-sm font-medium">
                            Number Notes
                          </Label>
                          <Textarea
                            id="edit-number-notes"
                            placeholder="Optional notes about the number assignment..."
                            value={numberNotes}
                            onChange={(e) => setNumberNotes(e.target.value)}
                            className="mt-1.5"
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label htmlFor="edit-porting-status" className="text-sm font-medium">
                            Porting Status
                          </Label>
                          <Select value={portingStatus} onValueChange={setPortingStatus}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_porting">Not Porting</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="edit-porting-instructions" className="text-sm font-medium">
                            Porting Instructions
                          </Label>
                          <Textarea
                            id="edit-porting-instructions"
                            placeholder="Detailed instructions for number porting..."
                            value={portingInstructions}
                            onChange={(e) => setPortingInstructions(e.target.value)}
                            className="mt-1.5"
                            rows={3}
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setDialogStep(1)}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                        <Button
                          onClick={() => setDialogStep(3)}
                          className="flex-1"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </>
                  )}

                  {(selectedBusiness.status === "rejected" || selectedBusiness.status === "revoked") && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setDialogStep(1)}
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <p className="text-sm text-muted-foreground flex-1 flex items-center justify-center">
                        This business has been {selectedBusiness.status}.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Twilio & MessageBird */}
              {dialogStep === 3 && (
                <>
                  {selectedBusiness.status === "approved" && userPermissions.can_approve_businesses && (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Twilio & Calls
                        </h3>
                        
                        <div>
                          <Label htmlFor="twilio-phone" className="text-sm font-medium">
                            Twilio Phone Number
                          </Label>
                          <Input
                            id="twilio-phone"
                            placeholder="+442896021192"
                            value={twilioPhoneNumber}
                            onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            The Twilio number assigned to this business
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Twilio Enabled</Label>
                            <p className="text-xs text-muted-foreground">
                              Enable inbound voice calls via Twilio
                            </p>
                          </div>
                          <Switch
                            checked={twilioEnabled}
                            onCheckedChange={handleTwilioToggle}
                          />
                        </div>
                        
                        {(twilioEnabled || twilioWebhookToken) && (
                          <div>
                            <Label className="text-sm font-medium">Webhook URL</Label>
                            <div className="flex gap-2 mt-1.5">
                              <Input
                                value={getWebhookUrl()}
                                readOnly
                                className="bg-muted font-mono text-xs"
                                placeholder="Enable Twilio to generate webhook URL"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copyWebhookUrl}
                                disabled={!twilioWebhookToken}
                              >
                                {copiedWebhook ? (
                                  <Check className="w-4 h-4 text-success" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Paste this URL in Twilio's Voice webhook settings
                            </p>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          MessageBird & Calls
                        </h3>
                        
                        <div>
                          <Label htmlFor="messagebird-phone" className="text-sm font-medium">
                            MessageBird Phone Number
                          </Label>
                          <Input
                            id="messagebird-phone"
                            placeholder="+447418314153"
                            value={messagebirdPhoneNumber}
                            onChange={(e) => setMessagebirdPhoneNumber(e.target.value)}
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            The MessageBird number assigned to this business
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">MessageBird Enabled</Label>
                            <p className="text-xs text-muted-foreground">
                              Enable inbound voice calls via MessageBird
                            </p>
                          </div>
                          <Switch
                            checked={messagebirdEnabled}
                            onCheckedChange={handleMessagebirdToggle}
                          />
                        </div>
                        
                        {(messagebirdEnabled || messagebirdToken) && (
                          <div>
                            <Label className="text-sm font-medium">Webhook URL (Answer URL)</Label>
                            <div className="flex gap-2 mt-1.5">
                              <Input
                                value={getMessagebirdWebhookUrl()}
                                readOnly
                                className="bg-muted font-mono text-xs"
                                placeholder="Enable MessageBird to generate webhook URL"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copyMessagebirdWebhookUrl}
                                disabled={!messagebirdToken}
                              >
                                {copiedMessagebirdWebhook ? (
                                  <Check className="w-4 h-4 text-success" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Paste this URL in MessageBird Flow Builder's "Fetch call flow from URL" step
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setDialogStep(2)}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                        <Button
                          onClick={() => handleUpdateApprovedBusiness(selectedBusiness.id)}
                          disabled={!!actionLoading}
                          className="flex-1"
                        >
                          {actionLoading === selectedBusiness.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleAction(selectedBusiness.id, "revoked")}
                          disabled={!!actionLoading}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Revoke
                        </Button>
                      </div>
                    </>
                  )}
                </>
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
                      checked={adminPermissions.can_manage_business_numbers}
                      onChange={(e) =>
                        setAdminPermissions({
                          ...adminPermissions,
                          can_manage_business_numbers: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Can manage business numbers</span>
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
                    <span className="text-sm">Can view calls & messages</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleAdminAction(selectedAdmin.user_id, "approve")}
                  disabled={!!actionLoading}
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
                  disabled={!!actionLoading}
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin AI Assistant Chat */}
      {currentUserId && (
        <AiviaAssistantChat
          userId={currentUserId}
          role="admin"
        />
      )}
    </div>
  );
};

export default AdminDashboard;
