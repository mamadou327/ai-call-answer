import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Loader2, CheckCircle } from "lucide-react";

const POSITION_OPTIONS = [
  "Stylist",
  "Barber",
  "Receptionist",
  "Therapist",
  "Nail Technician",
  "Beautician",
  "Massage Therapist",
  "Manager",
  "Assistant",
  "Other",
];

const StaffInvite = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [staffCount, setStaffCount] = useState<number>(0);
  const [codeValidated, setCodeValidated] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    joinCode: "",
    firstName: "",
    lastName: "",
    phone: "",
    position: "",
    chair: "",
  });

  const validateJoinCode = async () => {
    if (!formData.joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a join code",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_staff_join_code', { p_code: formData.joinCode });

      if (validationError) {
        throw new Error("Failed to validate join code");
      }

      if (!validationResult || validationResult.length === 0) {
        toast({
          title: "Invalid Code",
          description: "This code is invalid or has expired. Please ask your manager for a new code.",
          variant: "destructive",
        });
        return;
      }

      const businessId = validationResult[0].business_id;
      setBusinessName(validationResult[0].business_name);

      // Fetch staff count for chair dropdown
      const { data: businessData } = await supabase
        .from("businesses")
        .select("staff_count")
        .eq("id", businessId)
        .single();

      setStaffCount(businessData?.staff_count || 5);
      setCodeValidated(true);

      toast({
        title: "Code Validated",
        description: `You're joining ${validationResult[0].business_name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate code",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codeValidated) {
      toast({
        title: "Error",
        description: "Please validate your join code first",
        variant: "destructive",
      });
      return;
    }

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

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your first and last name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.position) {
      toast({
        title: "Error",
        description: "Please select your position",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // First, try to sign up new user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      let userId: string | null = null;

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          // User exists - try to sign them in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (signInError) {
            toast({
              title: "Account Exists",
              description: "An account with this email already exists. Please use the correct password.",
              variant: "destructive",
            });
            setIsProcessing(false);
            return;
          }

          userId = signInData.user.id;
        } else {
          throw signUpError;
        }
      } else {
        if (!authData.user) {
          throw new Error("Failed to create user account");
        }
        userId = authData.user.id;

        // Assign staff role for new users
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "staff" });

        if (roleError && !roleError.message.includes("duplicate")) {
          console.error("Role assignment error:", roleError);
        }
      }

      // Use secure RPC function to create staff membership
      const { data: membershipId, error: membershipError } = await supabase
        .rpc('create_staff_membership_with_code', {
          p_join_code: formData.joinCode,
          p_first_name: formData.firstName.trim(),
          p_last_name: formData.lastName.trim(),
          p_phone: formData.phone.trim() || null,
          p_position: formData.position || null,
          p_chair: formData.chair || null,
        });

      if (membershipError) {
        console.error("Membership creation error:", membershipError);
        if (membershipError.message.includes("Invalid or expired")) {
          toast({
            title: "Invalid Code",
            description: "This code is invalid or has expired. Please ask your manager for a new code.",
            variant: "destructive",
          });
        } else if (membershipError.message.includes("pending")) {
          toast({
            title: "Already Pending",
            description: "Your request is already pending approval.",
          });
          navigate("/staff/pending");
          return;
        } else {
          throw new Error("Failed to create staff membership");
        }
        await supabase.auth.signOut();
        setIsProcessing(false);
        return;
      }

      await supabase.auth.signOut();
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
            <Button onClick={() => navigate("/staff/login")} variant="outline" className="w-full">
              Go to Staff Login
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
            Enter the join code from your employer to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Validate Join Code */}
          {!codeValidated ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Join Code *</Label>
                <Input
                  id="joinCode"
                  type="text"
                  placeholder="e.g. EXCL-4827"
                  value={formData.joinCode}
                  onChange={(e) => setFormData({ ...formData, joinCode: e.target.value.toUpperCase() })}
                  className="uppercase tracking-wider font-mono text-center text-lg"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Get this code from your employer/manager
                </p>
              </div>
              <Button onClick={validateJoinCode} className="w-full" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate Code"
                )}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/auth?mode=signin")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Fill in Details */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-800">
                  ✓ Joining <strong>{businessName}</strong>
                </p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your position" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((position) => (
                      <SelectItem key={position} value={position}>
                        {position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Chair Selection */}
              <div className="space-y-2">
                <Label htmlFor="chair">Chair/Station (Optional)</Label>
                <Select
                  value={formData.chair}
                  onValueChange={(value) => setFormData({ ...formData, chair: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your chair" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: staffCount }, (_, i) => (
                      <SelectItem key={i + 1} value={`Chair ${i + 1}`}>
                        Chair {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If applicable to your salon/barbershop
                </p>
              </div>

              {/* Contact Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Contact Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+44 7XXX XXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              {/* Password Fields */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password (min 6 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
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
                  "Join & Request Access"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setCodeValidated(false);
                  setFormData({ ...formData, joinCode: "" });
                }}
                className="w-full text-sm text-muted-foreground hover:text-primary"
              >
                Use a different code
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffInvite;