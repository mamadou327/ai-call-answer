import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Loader2, ArrowLeft } from "lucide-react";
import { authSchema, signUpSchema } from "@/lib/validation";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Check URL parameter to determine initial mode
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode');
  const [isSignUp, setIsSignUp] = useState(mode !== 'signin');
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingEmailError, setExistingEmailError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Check if user has completed onboarding
        checkOnboardingStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkOnboardingStatus = async (userId: string) => {
    // Check user role first
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = roles?.map(r => r.role) || [];

    // If user is staff, send them to dashboard (not onboarding)
    if (userRoles.includes("staff")) {
      navigate("/dashboard");
      return;
    }

    // If user is admin, send them to admin dashboard
    if (userRoles.includes("super_admin") || userRoles.includes("sub_admin")) {
      navigate("/admin");
      return;
    }

    // For business owners, check their business status
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", userId)
      .single();

    if (!business) {
      // Assign business_owner role if they don't have any role
      if (userRoles.length === 0) {
        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "business_owner" });
      }
      navigate("/onboarding");
    } else if (business.status === "pending") {
      navigate("/pending-approval");
    } else if (business.status === "approved") {
      navigate("/dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setExistingEmailError(false);
    setIsLoading(true);

    try {
      // Validate with Zod
      const schema = isSignUp ? signUpSchema : authSchema;
      const result = schema.safeParse(formData);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        // First check if there's a pending staff invite for this email
        const { data: pendingInvite } = await supabase
          .from("staff_invites")
          .select("*, businesses(business_name)")
          .eq("email", formData.email)
          .eq("status", "pending")
          .maybeSingle();

        const { data: authData, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });

        if (error) {
          // Check if it's a "user already exists" error
          if (error.message?.toLowerCase().includes("already") || 
              error.message?.toLowerCase().includes("exists") ||
              error.status === 422) {
            setExistingEmailError(true);
            setIsLoading(false);
            return;
          }
          throw error;
        }

        if (!authData.user) {
          throw new Error("User creation failed");
        }

        // If there's a pending staff invite, handle as staff signup
        if (pendingInvite) {
          console.log("Found pending staff invite for", formData.email);
          
          // Assign staff role
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({ user_id: authData.user.id, role: "staff" });

          if (roleError && !roleError.message.includes("duplicate")) {
            console.error("Error assigning staff role:", roleError);
          }

          // Link to staff account if exists
          const { error: accountError } = await supabase
            .from("staff_accounts")
            .update({ 
              user_id: authData.user.id,
              status: "active"
            })
            .eq("business_id", pendingInvite.business_id)
            .eq("email", pendingInvite.email);

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
            .eq("id", pendingInvite.id);

          toast({
            title: "Account created!",
            description: `Welcome to ${pendingInvite.businesses?.business_name}. You've been added as staff.`,
          });

          // Will be redirected to dashboard by checkOnboardingStatus
        } else {
          // Normal business owner signup
          toast({
            title: "Account created!",
            description: "Welcome to Aivia. Let's set up your business.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "Successfully signed in",
        });
      }
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

  const switchToLogin = () => {
    setExistingEmailError(false);
    setIsSignUp(false);
    setFormData({ ...formData, confirmPassword: "" });
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

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={aiviaLogo} alt="Aivia" className="h-20 w-auto" />
              <span className="text-3xl font-bold text-primary">Aivia</span>
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
                    placeholder="you@salon.com"
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
            <img src={aiviaLogo} alt="Aivia" className="h-20 w-auto" />
            <span className="text-3xl font-bold text-primary">Aivia</span>
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Create your account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Start your journey with Aivia"
              : "Sign in to your Aivia account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingEmailError && (
            <div className="mb-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm font-medium text-warning mb-2">
                This email already has an account
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                It looks like you've already registered with this email. Please sign in instead.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={switchToLogin}
                className="w-full"
              >
                Switch to Sign In
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@salon.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            )}
          </form>
          <div className="mt-4 text-center text-sm">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setExistingEmailError(false);
                    setFormData({ ...formData, confirmPassword: "" });
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setExistingEmailError(false);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;