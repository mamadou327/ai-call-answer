import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OnboardingStep1 from "@/components/onboarding/OnboardingStep1";
import OnboardingStep2 from "@/components/onboarding/OnboardingStep2";
import OnboardingStep3 from "@/components/onboarding/OnboardingStep3";
import OnboardingStep4 from "@/components/onboarding/OnboardingStep4";
import OnboardingStep5 from "@/components/onboarding/OnboardingStep5";
import BusinessCategorySelector, { BusinessCategory } from "@/components/onboarding/BusinessCategorySelector";
import RestaurantTypeSelector from "@/components/onboarding/RestaurantTypeSelector";
import { BusinessType } from "@/components/onboarding/BusinessTypeSelector";
import RestaurantDetailsStep from "@/components/onboarding/RestaurantDetailsStep";
import aiviaLogo from "@/assets/aivia-logo-new.png";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Step flow: 0 = category, 0.5 = restaurant type (if restaurant), 1-5 = normal steps
  const [currentStep, setCurrentStep] = useState(0);
  const [showRestaurantTypeStep, setShowRestaurantTypeStep] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<BusinessType>("salon");
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
  const [restaurantData, setRestaurantData] = useState({
    cuisineType: "",
    menuLink: "",
    tableCount: 5,
    maxPartySize: 8,
    paymentMethods: ["card"] as string[],
    requirePrepayment: false,
    prepaymentType: "none" as "none" | "deposit" | "full",
    minimumOrderAmount: 0,
    refundPolicy: "full_refund" as "full_refund" | "partial_refund" | "store_credit" | "no_refund",
    refundWindowHours: 2,
    averagePrepTime: 30,
  });

  // Determine if this is a restaurant type
  const isRestaurant = businessType.startsWith("restaurant");

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
        setBusinessType((business.business_type || "salon") as BusinessType);
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
        // Pre-fill restaurant data if applicable
        if (business.business_type?.startsWith("restaurant")) {
          setRestaurantData({
            cuisineType: business.cuisine_type || "",
            menuLink: business.menu_link || "",
            tableCount: 5,
            maxPartySize: 8,
            paymentMethods: business.payment_methods || ["card"],
            requirePrepayment: business.require_prepayment || false,
            prepaymentType: (business.prepayment_type as "none" | "deposit" | "full") || "none",
            minimumOrderAmount: business.minimum_order_amount || 0,
            refundPolicy: (business.refund_policy as "full_refund" | "partial_refund" | "store_credit" | "no_refund") || "full_refund",
            refundWindowHours: business.refund_window_hours || 2,
            averagePrepTime: business.average_prep_time_minutes || 30,
          });
        }
        // Skip to step 1 if business exists
        setCurrentStep(1);
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

  const updateRestaurantData = (updates: Partial<typeof restaurantData>) => {
    setRestaurantData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    // If on step 1 and restaurant, go back to restaurant type selection
    if (currentStep === 1 && isRestaurant) {
      setShowRestaurantTypeStep(true);
      setCurrentStep(0);
      return;
    }
    // If on step 1 and salon, go back to category selection
    if (currentStep === 1 && !isRestaurant) {
      setCurrentStep(0);
      return;
    }
    setCurrentStep(prev => prev - 1);
  };

  const handleCategorySelect = (category: BusinessCategory) => {
    if (category === "salon") {
      setBusinessType("salon");
      setShowRestaurantTypeStep(false);
      setCurrentStep(1);
    } else {
      // Show restaurant type selection
      setShowRestaurantTypeStep(true);
    }
  };

  const handleRestaurantTypeSelect = (type: BusinessType) => {
    setBusinessType(type);
    setShowRestaurantTypeStep(false);
    setCurrentStep(1);
  };

  const handleRestaurantTypeBack = () => {
    setShowRestaurantTypeStep(false);
  };

  // Render the correct step based on current step and business type
  const renderStep = () => {
    // Step 0: Business category selection
    if (currentStep === 0 && !showRestaurantTypeStep) {
      return (
        <BusinessCategorySelector
          onSelect={handleCategorySelect}
        />
      );
    }

    // Step 0.5: Restaurant type selection (if restaurant was selected)
    if (currentStep === 0 && showRestaurantTypeStep) {
      return (
        <RestaurantTypeSelector
          onSelect={handleRestaurantTypeSelect}
          onBack={handleRestaurantTypeBack}
        />
      );
    }

    // For salon: standard flow
    if (!isRestaurant) {
      switch (currentStep) {
        case 1:
          return (
            <OnboardingStep1
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
              userId={userId}
            />
          );
        case 2:
          return (
            <OnboardingStep2
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
              onBack={handleBack}
              userId={userId}
              businessId={businessId}
              setBusinessId={setBusinessId}
            />
          );
        case 3:
          return (
            <OnboardingStep3
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
              onBack={handleBack}
              businessId={businessId}
            />
          );
        case 4:
          return (
            <OnboardingStep4
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNext}
              onBack={handleBack}
              businessId={businessId}
            />
          );
        case 5:
          return (
            <OnboardingStep5
              formData={formData}
              updateFormData={updateFormData}
              onBack={handleBack}
              businessId={businessId}
            />
          );
        default:
          return null;
      }
    }

    // For restaurant: modified flow
    switch (currentStep) {
      case 1:
        return (
          <OnboardingStep1
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            userId={userId}
          />
        );
      case 2:
        return (
          <OnboardingStep2
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            userId={userId}
            businessId={businessId}
            setBusinessId={setBusinessId}
          />
        );
      case 3:
        // Restaurant-specific step
        return (
          <RestaurantDetailsStep
            businessId={businessId}
            businessType={businessType}
            formData={restaurantData}
            updateFormData={updateRestaurantData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <OnboardingStep4
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            businessId={businessId}
          />
        );
      case 5:
        return (
          <OnboardingStep5
            formData={formData}
            updateFormData={updateFormData}
            onBack={handleBack}
            businessId={businessId}
          />
        );
      default:
        return null;
    }
  };

  // Calculate display steps for progress indicator
  const getDisplayStep = () => {
    if (currentStep === 0) return 1;
    if (showRestaurantTypeStep) return 1;
    return currentStep + 1;
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
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step === getDisplayStep()
                      ? "bg-primary text-primary-foreground"
                      : step < getDisplayStep()
                      ? "bg-success text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 6 && (
                  <div
                    className={`h-1 w-8 md:w-16 ${
                      step < getDisplayStep() ? "bg-success" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {renderStep()}
      </div>
    </div>
  );
};

export default Onboarding;
