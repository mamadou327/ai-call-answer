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
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
    loadBusinesses();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      navigate("/dashboard");
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
        .select("user_id, first_name, last_name")
        .in("user_id", ownerIds);

      const profilesMap: Record<string, Profile> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = {
          first_name: p.first_name,
          last_name: p.last_name,
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
          <h1 className="text-3xl font-bold mb-2">Business Applications</h1>
          <p className="text-muted-foreground">Review and manage business onboarding applications</p>
        </div>

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
    </div>
  );
};

const Label = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
);

export default AdminDashboard;