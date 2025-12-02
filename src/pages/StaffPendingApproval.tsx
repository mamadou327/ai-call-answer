import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Clock, XCircle, RefreshCw } from "lucide-react";

interface MembershipStatus {
  status: string;
  business_name: string;
}

const StaffPendingApproval = () => {
  const navigate = useNavigate();
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkMembershipStatus();
  }, []);

  const checkMembershipStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check for staff membership
    const { data: membershipData } = await supabase
      .from("staff_memberships")
      .select("status, business_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membershipData) {
      // No membership, redirect to staff invite
      navigate("/staff/invite");
      return;
    }

    // Get business name
    const { data: businessData } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", membershipData.business_id)
      .single();

    setMembership({
      status: membershipData.status,
      business_name: businessData?.business_name || "Unknown Business",
    });

    if (membershipData.status === "active") {
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleRefresh = () => {
    setLoading(true);
    checkMembershipStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (membership?.status === "revoked") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
              <span className="text-2xl font-bold text-primary">Aivia</span>
            </div>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Access Revoked</CardTitle>
            <CardDescription className="text-base mt-2">
              Your staff access to <strong>{membership.business_name}</strong> has been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              If you believe this is a mistake, please contact the business owner.
            </p>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
            <span className="text-2xl font-bold text-primary">Aivia</span>
          </div>
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Awaiting Approval</CardTitle>
          <CardDescription className="text-base mt-2">
            Your staff access to <strong>{membership?.business_name}</strong> is pending approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            The business owner needs to approve your access before you can use the dashboard.
            This usually happens within 24 hours.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} variant="default" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffPendingApproval;