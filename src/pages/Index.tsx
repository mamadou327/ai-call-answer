import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Landing page sections
import Header, { ActiveSection } from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import BusinessTypeSelector from "@/components/landing/BusinessTypeSelector";
import ProblemSection from "@/components/landing/ProblemSection";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import ComparisonTable from "@/components/landing/ComparisonTable";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  // Scroll to section when it becomes active
  useEffect(() => {
    if (activeSection && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [activeSection]);

  const handleSectionChange = (section: ActiveSection) => {
    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header activeSection={activeSection} onSectionChange={handleSectionChange} />
      <HeroSection />
      
      {/* Dynamic Content Area - Shows based on nav selection */}
      <div ref={sectionRef}>
        {activeSection === 'features' && (
          <div id="features" className="animate-fade-in">
            <BusinessTypeSelector />
            <FeatureShowcase />
            <ProblemSection />
          </div>
        )}

        {activeSection === 'pricing' && (
          <div id="pricing" className="animate-fade-in">
            <PricingSection />
            <ComparisonTable />
          </div>
        )}

        {activeSection === 'faq' && (
          <div id="faq" className="animate-fade-in">
            <FAQSection />
          </div>
        )}
      </div>

      {/* Always visible sections */}
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
