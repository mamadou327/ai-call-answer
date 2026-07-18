import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Critical above-the-fold components loaded eagerly
import Header, { ActiveSection } from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

// Lazy load conditional sections to reduce initial bundle size
const BusinessTypeSelector = lazy(() => import("@/components/landing/BusinessTypeSelector"));
const ProblemSection = lazy(() => import("@/components/landing/ProblemSection"));
const FeatureShowcase = lazy(() => import("@/components/landing/FeatureShowcase"));
const PricingSection = lazy(() => import("@/components/landing/PricingSection"));
const FAQSection = lazy(() => import("@/components/landing/FAQSection"));
const ComparisonTable = lazy(() => import("@/components/landing/ComparisonTable"));

const SectionLoader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roleSet = new Set((roles || []).map((r: any) => r.role));
      if (roleSet.has("super_admin") || roleSet.has("sub_admin")) {
        navigate("/admin");
      } else if (roleSet.has("staff")) {
        navigate("/staff/dashboard");
      } else {
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
      <main>
        <HeroSection />
        
        {/* Dynamic Content Area - Shows based on nav selection */}
        <div ref={sectionRef}>
          {activeSection === 'features' && (
            <Suspense fallback={<SectionLoader />}>
              <div id="features" className="animate-fade-in">
                <BusinessTypeSelector />
                <FeatureShowcase />
                <ProblemSection />
              </div>
            </Suspense>
          )}

          {activeSection === 'pricing' && (
            <Suspense fallback={<SectionLoader />}>
              <div id="pricing" className="animate-fade-in">
                <PricingSection />
                <ComparisonTable />
              </div>
            </Suspense>
          )}

          {activeSection === 'faq' && (
            <Suspense fallback={<SectionLoader />}>
              <div id="faq" className="animate-fade-in">
                <FAQSection />
              </div>
            </Suspense>
          )}
        </div>

        {/* Always visible sections */}
        <FinalCTA />
      </main>
      <Footer onFaqClick={() => handleSectionChange('faq')} />
    </div>
  );
};

export default Index;
