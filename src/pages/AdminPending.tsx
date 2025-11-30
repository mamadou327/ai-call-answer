import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Clock, LogOut } from "lucide-react";

const AdminPending = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some(r => r.role === "super_admin");
    const isSubAdmin = roles?.some(r => r.role === "sub_admin");

    if (isSuperAdmin || isSubAdmin) {
      navigate("/admin");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={aiviaLogo} alt="Aivia" className="h-12 w-auto" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </div>
          <CardTitle className="text-2xl">Request Pending</CardTitle>
          <CardDescription>
            Your admin access request is waiting for approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              Your request for admin access has been received and is currently under review.
            </p>
            <p className="text-sm text-muted-foreground">
              You will be contacted by the Aivia team via email once your request has been processed.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPending;
