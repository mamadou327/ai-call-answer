import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Loader2, ArrowLeft } from "lucide-react";

const StaffLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!data.user) {
        toast({
          title: "Error",
          description: "Failed to sign in",
          variant: "destructive",
        });
        return;
      }

      // Check staff membership status
      const { data: membership } = await supabase
        .from("staff_memberships")
        .select("status, business_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!membership) {
        toast({
          title: "No Staff Account",
          description: "No staff membership found. Please use a join code to register.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/staff/invite");
        return;
      }

      if (membership.status === "pending_approval") {
        navigate("/staff/pending");
        return;
      }

      if (membership.status === "revoked") {
        toast({
          title: "Access Revoked",
          description: "Your staff access has been revoked. Contact the business owner.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      if (membership.status === "active") {
        navigate("/staff/dashboard");
        return;
      }

      // Fallback
      navigate("/staff/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) return;

    setForgotPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setForgotPasswordSent(true);
      toast({
        title: "Reset Link Sent",
        description: "If an account exists with that email, a password reset link has been sent.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
              <span className="text-2xl font-bold text-primary">Aivia</span>
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your email to receive a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotPasswordSent ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  If an account exists with that email, a password reset link has been sent.
                  Please check your inbox.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordSent(false);
                    setForgotPasswordEmail("");
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="your.email@example.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail("");
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </form>
            )}
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
          <CardTitle className="text-2xl">Staff Login</CardTitle>
          <CardDescription>
            Sign in to your staff account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/staff/invite")}
                className="text-primary hover:underline font-medium"
              >
                Join with code
              </button>
            </p>
            <p className="text-sm text-muted-foreground">
              Business owner?{" "}
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-primary hover:underline font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
