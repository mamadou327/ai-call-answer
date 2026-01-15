import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import ContactDialog from "./ContactDialog";
import FeaturesDialog from "./FeaturesDialog";
import PricingDialog from "./PricingDialog";

export type ActiveSection = 'features' | 'how-it-works' | 'pricing' | 'demo' | 'faq' | null;

interface HeaderProps {
  activeSection?: ActiveSection;
  onSectionChange?: (section: ActiveSection) => void;
}

const Header = ({ activeSection, onSectionChange }: HeaderProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const handleNavClick = (section: string) => {
    if (section === "features") {
      setFeaturesOpen(true);
    } else if (section === "pricing") {
      setPricingOpen(true);
    } else if (section === "faq" && onSectionChange) {
      // Toggle FAQ section on page
      if (activeSection === "faq") {
        onSectionChange(null);
      } else {
        onSectionChange("faq");
      }
    }
    setMobileMenuOpen(false);
  };

  const handleContactClick = () => {
    setContactOpen(true);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          {/* Logo */}
          <button 
            onClick={() => navigate("/")} 
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img src={aiviaLogo} alt="AIVIA" className="h-12 w-auto" />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => handleNavClick("features")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => handleNavClick("pricing")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => handleNavClick("faq")}
              className={`text-sm font-medium transition-colors ${
                activeSection === "faq"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FAQ
            </button>
            <button
              onClick={handleContactClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </button>
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth?mode=signin")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="shadow-sm">
              Try Free
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <nav className="flex flex-col gap-4 mt-8">
                  <button
                    onClick={() => handleNavClick("features")}
                    className="text-left py-2 text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Features
                  </button>
                  <button
                    onClick={() => handleNavClick("pricing")}
                    className="text-left py-2 text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Pricing
                  </button>
                  <button
                    onClick={() => handleNavClick("faq")}
                    className={`text-left py-2 text-lg font-medium transition-colors ${
                      activeSection === "faq"
                        ? "text-primary font-semibold"
                        : "text-foreground hover:text-primary"
                    }`}
                  >
                    FAQ
                  </button>
                  <button
                    onClick={handleContactClick}
                    className="text-left py-2 text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Contact
                  </button>
                  
                  <div className="border-t border-border pt-4 mt-4 space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        navigate("/auth?mode=signin");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                    <Button 
                      className="w-full"
                      onClick={() => {
                        navigate("/auth");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Try Free
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
      <FeaturesDialog open={featuresOpen} onOpenChange={setFeaturesOpen} />
      <PricingDialog open={pricingOpen} onOpenChange={setPricingOpen} />
    </>
  );
};

export default Header;
