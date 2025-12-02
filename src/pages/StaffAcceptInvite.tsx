import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const StaffAcceptInvite = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    validateInvite();
    checkAuthStatus();
  }, [token]);

  const checkAuthStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  };

  const validateInvite = async () => {
    if (!token) {
      console.error("No invite token provided in URL");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Validating invite token:", token);
      
      const { data, error } = await supabase
        .from("staff_invites")
        .select("*, businesses(business_name)")
        .eq("invite_token", token)
        .eq("status", "pending")
        .single();

      if (error) {
        console.error("Error fetching staff invite:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        setInviteValid(false);
      } else if (!data) {
        console.error("No staff invite found for token");
        setInviteValid(false);
      } else {
        console.log("Valid invite found:", data);
        setInviteValid(true);
        setInviteData(data);
        setFormData(prev => ({ ...prev, email: data.email }));
      }
    } catch (error) {
      console.error("Exception validating invite:", error);
      console.error("Exception details:", JSON.stringify(error, null, 2));
      setInviteValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInviteForExistingUser = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Assign staff role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "staff" });

      if (roleError && !roleError.message.includes("duplicate")) {
        throw roleError;
      }

      // Link to staff account if exists
      const { error: accountError } = await supabase
        .from("staff_accounts")
        .update({ 
          user_id: user.id,
          status: "active"
        })
        .eq("business_id", inviteData.business_id)
        .eq("email", inviteData.email);

      if (accountError) {
        console.error("Error linking staff account:", accountError);
      }

      // Mark invite as accepted
      await supabase
        .from("staff_invites")
        .update({ 
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", inviteData.id);

      toast({
        title: "Invitation accepted!",
        description: `Welcome to ${inviteData.businesses.business_name}`,
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("User creation failed");

      // Assign staff role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: "staff" });

      if (roleError) throw roleError;

      // Link to staff account if exists
      const { error: accountError } = await supabase
        .from("staff_accounts")
        .update({ 
          user_id: authData.user.id,
          status: "active"
        })
        .eq("business_id", inviteData.business_id)
        .eq("email", inviteData.email);

      if (accountError) {
        console.error("Error linking staff account:", accountError);
      }

      // Mark invite as accepted
      await supabase
        .from("staff_invites")
        .update({ 
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", inviteData.id);

      toast({
        title: "Account created!",
        description: `Welcome to ${inviteData.businesses.business_name}`,
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !inviteValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid, expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-success" />
            </div>
            <CardTitle className="text-2xl">Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{inviteData.businesses.business_name}</strong> as a staff member.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={acceptInviteForExistingUser}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
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
            <img src={aiviaLogo} alt="Aivia" className="h-20 w-auto" />
            <span className="text-3xl font-bold text-primary">Aivia</span>
          </div>
          <CardTitle className="text-2xl">Join {inviteData.businesses.business_name}</CardTitle>
          <CardDescription>
            Create your account to accept the invitation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account & Accept"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-primary hover:underline font-medium"
            >
              Sign in instead
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffAcceptInvite;
