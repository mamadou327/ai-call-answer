import { useState } from "react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import FeaturesDialog from "./FeaturesDialog";
import PricingDialog from "./PricingDialog";
import ContactDialog from "./ContactDialog";
import AboutUsDialog from "./AboutUsDialog";

interface FooterProps {
  onFaqClick?: () => void;
}

const Footer = ({ onFaqClick }: FooterProps) => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleFaqClick = () => {
    if (onFaqClick) {
      onFaqClick();
    }
  };

  return (
    <>
      <footer className="border-t-2 border-border bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Logo & Description */}
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src={aiviaLogo} alt="AIVIA" className="h-10 w-auto" width="65" height="40" loading="lazy" decoding="async" />
                <span className="text-xl font-bold">AIVIA</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs">
                Your AI assistant that answers calls, books appointments, and keeps your business running even when you can't.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <div className="font-semibold mb-4" role="heading" aria-level={2}>Product</div>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => setFeaturesOpen(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setPricingOpen(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <div className="font-semibold mb-4" role="heading" aria-level={2}>Company</div>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => setAboutOpen(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setContactOpen(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <button 
                    onClick={handleFaqClick}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-8 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              © 2025 AIVIA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <FeaturesDialog open={featuresOpen} onOpenChange={setFeaturesOpen} />
      <PricingDialog open={pricingOpen} onOpenChange={setPricingOpen} />
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
      <AboutUsDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
};

export default Footer;
