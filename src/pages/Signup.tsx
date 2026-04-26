import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import { cn } from "@/lib/utils";

type BusinessTypeValue =
  | "restaurant_pickup"
  | "restaurant_dine_in"
  | "restaurant_hybrid"
  | "salon";

const BUSINESS_TYPES: { value: BusinessTypeValue; label: string }[] = [
  { value: "restaurant_pickup", label: "Restaurant — Pickup/Takeaway" },
  { value: "restaurant_dine_in", label: "Restaurant — Dine-in" },
  { value: "restaurant_hybrid", label: "Restaurant — Both" },
  { value: "salon", label: "Salon / Barbershop / Spa" },
];

const SELECTABLE_TIERS: SubscriptionTier[] = ["starter", "growth", "scale"];

const schema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    businessName: z.string().trim().min(1, "Business name is required").max(120),
    businessType: z.enum([
      "restaurant_pickup",
      "restaurant_dine_in",
      "restaurant_hybrid",
      "salon",
    ]),
    phone: z.string().trim().min(5, "Phone number is required").max(30),
    email: z.string().trim().email("Invalid email address").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingEmailError, setExistingEmailError] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [reapplyMode, setReapplyMode] = useState(false);
  const [existingBusinessId, setExistingBusinessId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    businessType: "" as BusinessTypeValue | "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, business_name, business_type, main_phone, status, rejection_reason")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!biz) return;

      if (biz.status === "approved") {
        navigate("/dashboard");
        return;
      }
      if (biz.status === "pending") {
        navigate("/pending-approval");
        return;
      }
      if (biz.status === "rejected") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: settings } = await supabase
          .from("business_settings")
          .select("subscription_tier")
          .eq("business_id", biz.id)
          .maybeSingle();

        setReapplyMode(true);
        setExistingBusinessId(biz.id);
        setRejectionReason(biz.rejection_reason || null);
        setForm({
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          businessName: biz.business_name || "",
          businessType: (biz.business_type as BusinessTypeValue) || "",
          phone: biz.main_phone || "",
          email: profile?.email || user.email || "",
          password: "",
          confirmPassword: "",
        });
        if (settings?.subscription_tier && SELECTABLE_TIERS.includes(settings.subscription_tier as SubscriptionTier)) {
          setSelectedTier(settings.subscription_tier as SubscriptionTier);
        }
      }
    })();
  }, [navigate]);

  const update = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setExistingEmailError(false);

    if (!selectedTier) {
      toast({
        title: "Choose a plan",
        description: "Please select a plan before submitting.",
        variant: "destructive",
      });
      return;
    }

    const dataToValidate = reapplyMode
      ? { ...form, password: "placeholder1", confirmPassword: "placeholder1" }
      : form;

    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      let userId = currentUserId;

      if (!reapplyMode) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (authError) {
          const code = (authError as any).code as string | undefined;
          const msg = authError.message?.toLowerCase() || "";
          const isDuplicate =
            code === "user_already_exists" ||
            code === "email_exists" ||
            msg.includes("already registered") ||
            msg.includes("user already") ||
            msg.includes("already exists");
          if (isDuplicate) {
            setExistingEmailError(true);
            return;
          }
          if (code === "weak_password" || msg.includes("weak") || msg.includes("pwned")) {
            toast({
              title: "Password too weak",
              description:
                "That password has appeared in known data breaches. Please choose a stronger, unique password.",
              variant: "destructive",
            });
            return;
          }
          if (code === "invalid_email" || (msg.includes("invalid") && msg.includes("email"))) {
            toast({
              title: "Invalid email",
              description: "Please enter a valid email address.",
              variant: "destructive",
            });
            return;
          }
          throw authError;
        }

        if (!authData.user) throw new Error("Account creation failed");
        userId = authData.user.id;

        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            first_name: form.firstName,
            last_name: form.lastName,
            email: form.email,
          },
          { onConflict: "user_id" },
        );

        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "business_owner" })
          .then(() => undefined, () => undefined);
      } else {
        await supabase.from("profiles").upsert(
          {
            user_id: userId!,
            first_name: form.firstName,
            last_name: form.lastName,
          },
          { onConflict: "user_id" },
        );
      }

      let businessId = existingBusinessId;
      if (reapplyMode && existingBusinessId) {
        const { error: bizError } = await supabase
          .from("businesses")
          .update({
            business_name: form.businessName,
            main_phone: form.phone,
            business_type: form.businessType as BusinessTypeValue,
            status: "pending",
            rejection_reason: null,
          })
          .eq("id", existingBusinessId);
        if (bizError) throw bizError;
      } else {
        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .insert({
            owner_id: userId!,
            business_name: form.businessName,
            main_phone: form.phone,
            business_type: form.businessType as BusinessTypeValue,
            address: "",
            status: "pending",
            staff_count: 1,
          })
          .select("id")
          .single();
        if (bizError) throw bizError;
        businessId = bizData.id;
      }

      await supabase.from("business_settings").upsert(
        {
          business_id: businessId!,
          subscription_tier: selectedTier,
        },
        { onConflict: "business_id" },
      );

      try {
        await supabase.functions.invoke("send-admin-notification", {
          body: {
            businessName: form.businessName,
            ownerName: `${form.firstName} ${form.lastName}`.trim() || "Unknown",
            ownerEmail: form.email,
            phone: form.phone,
            address: "",
          },
        });
      } catch (emailErr) {
        console.error("Admin notification failed (non-blocking):", emailErr);
      }

      toast({
        title: reapplyMode ? "Application resubmitted" : "Account created",
        description: "Your application is now being reviewed.",
      });

      navigate("/pending-approval");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
              <span className="text-3xl font-bold text-primary">Aivia</span>
            </div>
            <CardTitle className="text-2xl">
              {reapplyMode ? "Reapply for Aivia" : "Create your Aivia account"}
            </CardTitle>
            <CardDescription>
              {reapplyMode
                ? "Update your details and resubmit for approval."
                : "Tell us about your business and pick a plan to get started."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {reapplyMode && rejectionReason && (
              <div className="flex gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive mb-1">
                    Your previous application was not approved
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {rejectionReason}
                  </p>
                </div>
              </div>
            )}

            {existingEmailError && (
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/10">
                <p className="text-sm font-medium text-warning mb-2">
                  This email already has an account
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Please sign in instead.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/auth?mode=signin")}
                  className="w-full"
                >
                  Switch to Sign In
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                />
                {errors.businessName && (
                  <p className="text-sm text-destructive">{errors.businessName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <Select
                  value={form.businessType || undefined}
                  onValueChange={(v) => update("businessType", v)}
                >
                  <SelectTrigger id="businessType">
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((bt) => (
                      <SelectItem key={bt.value} value={bt.value}>
                        {bt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.businessType && (
                  <p className="text-sm text-destructive">{errors.businessType}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              {!reapplyMode && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(e) => update("password", e.target.value)}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => update("confirmPassword", e.target.value)}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">Choose your plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the plan that fits your business. You can change it later.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {SELECTABLE_TIERS.map((tierId) => {
                    const tier = TIERS[tierId];
                    const isSelected = selectedTier === tierId;
                    return (
                      <button
                        key={tierId}
                        type="button"
                        onClick={() => setSelectedTier(tierId)}
                        className={cn(
                          "relative text-left rounded-lg border-2 p-4 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        {tier.popular && (
                          <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">
                            Most Popular
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <h4 className="font-semibold text-base">{tier.name}</h4>
                        <div className="mt-1">
                          <span className="text-2xl font-bold">{tier.priceLabel}</span>
                          <span className="text-sm text-muted-foreground">
                            {tier.priceSuffix}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1.5">
                          {tier.features.slice(0, 5).map((f, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                <p className="text-sm text-muted-foreground italic text-center">
                  No payment is taken today. Our team will be in touch after approval to
                  arrange billing.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !selectedTier}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {reapplyMode ? "Resubmitting..." : "Creating account..."}
                  </>
                ) : reapplyMode ? (
                  "Resubmit Application"
                ) : (
                  "Create Account & Submit"
                )}
              </Button>

              {!reapplyMode && (
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/auth?mode=signin")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
