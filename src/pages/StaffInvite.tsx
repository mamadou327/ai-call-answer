import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Loader2, CheckCircle } from "lucide-react";

const StaffInvite = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    joinCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Validate join code
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_staff_join_code', { p_code: formData.joinCode });

      if (validationError) {
        console.error("Validation error:", validationError);
        throw new Error("Failed to validate join code");
      }

      if (!validationResult || validationResult.length === 0) {
        toast({
          title: "Invalid Code",
          description: "This code is invalid or has expired. Please ask your manager for a new code.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const businessId = validationResult[0].business_id;
      const foundBusinessName = validationResult[0].business_name;
      setBusinessName(foundBusinessName);

      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please sign in and use the join code from the dashboard.",
            variant: "destructive",
          });
        } else {
          throw signUpError;
        }
        setIsProcessing(false);
        return;
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Assign staff role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: "staff" });

      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Role assignment error:", roleError);
      }

      // Create staff membership with pending_approval status
      const { error: membershipError } = await supabase
        .from("staff_memberships")
        .insert({
          business_id: businessId,
          user_id: authData.user.id,
          role: "staff",
          status: "pending_approval",
        });

      if (membershipError) {
        console.error("Membership creation error:", membershipError);
        throw new Error("Failed to create staff membership");
      }

      setIsSuccess(true);
      
    } catch (error: any) {
      console.error("Staff invite error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
              <span className="text-2xl font-bold text-primary">Aivia</span>
            </div>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Request Submitted!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your staff account request for <strong>{businessName}</strong> has been sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The business owner must approve your access before you can log in. 
              You'll receive an email once your account is approved.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
              Go to Login
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
          <CardTitle className="text-2xl">Join as Staff</CardTitle>
          <CardDescription>
            Enter your details and the join code from your employer to create your staff account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
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
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinCode">Join Code</Label>
              <Input
                id="joinCode"
                type="text"
                placeholder="e.g. EXCL-4827"
                value={formData.joinCode}
                onChange={(e) => setFormData({ ...formData, joinCode: e.target.value.toUpperCase() })}
                className="uppercase tracking-wider font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Get this code from your employer/manager
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Join & Request Access"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffInvite;