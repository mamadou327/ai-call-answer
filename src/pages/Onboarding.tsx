import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OnboardingStep1 from "@/components/onboarding/OnboardingStep1";
import OnboardingStep2 from "@/components/onboarding/OnboardingStep2";
import OnboardingStep3 from "@/components/onboarding/OnboardingStep3";
import OnboardingStep4 from "@/components/onboarding/OnboardingStep4";
import OnboardingStep5 from "@/components/onboarding/OnboardingStep5";
import aiviaLogo from "@/assets/aivia-logo-new.png";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string>("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    mainPhone: "",
    secondaryPhone: "",
    address: "",
    website: "",
    staffCount: 1,
    numberSelection: "aivia_provided" as "aivia_provided" | "port_existing" | "do_later",
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Check if user is staff - staff should not access onboarding
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map(r => r.role) || [];
      if (userRoles.includes("staff")) {
        toast({
          title: "Access Denied",
          description: "Staff members cannot access business onboarding.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Check if they already have a business (resuming onboarding)
      const { data: business } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (business) {
        setBusinessId(business.id);
        // Pre-fill form with existing data
        setFormData({
          firstName: "",
          lastName: "",
          businessName: business.business_name || "",
          mainPhone: business.main_phone || "",
          secondaryPhone: business.secondary_phone || "",
          address: business.address || "",
          website: business.website || "",
          staffCount: business.staff_count || 1,
          numberSelection: "aivia_provided",
        });
      }

      // Check profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setFormData(prev => ({
          ...prev,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
        }));
      }
    };
    checkUser();
  }, [navigate]);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="text-xl font-bold">Aivia</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step < currentStep
                      ? "bg-success text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div
                    className={`h-1 w-12 md:w-20 ${
                      step < currentStep ? "bg-success" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {currentStep === 1 && (
          <OnboardingStep1
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            userId={userId}
          />
        )}
        {currentStep === 2 && (
          <OnboardingStep2
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            userId={userId}
            businessId={businessId}
            setBusinessId={setBusinessId}
          />
        )}
        {currentStep === 3 && (
          <OnboardingStep3
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            businessId={businessId}
          />
        )}
        {currentStep === 4 && (
          <OnboardingStep4
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            businessId={businessId}
          />
        )}
        {currentStep === 5 && (
          <OnboardingStep5
            formData={formData}
            updateFormData={updateFormData}
            onBack={handleBack}
            businessId={businessId}
          />
        )}
      </div>
    </div>
  );
};

export default Onboarding;