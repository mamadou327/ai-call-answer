import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Landing page sections
import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import BusinessTypeSelector from "@/components/landing/BusinessTypeSelector";
import DemoAudioSection from "@/components/landing/DemoAudioSection";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import MidPageCTA from "@/components/landing/MidPageCTA";
import PricingSection from "@/components/landing/PricingSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FAQSection from "@/components/landing/FAQSection";
import ComparisonTable from "@/components/landing/ComparisonTable";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <BusinessTypeSelector />
      <DemoAudioSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeatureShowcase />
      <MidPageCTA />
      <PricingSection />
      <TestimonialsSection />
      <ComparisonTable />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
