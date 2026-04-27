import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Headphones } from "lucide-react";
import ContactDialog from "./ContactDialog";

const FinalCTA = () => {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="bg-primary text-primary-foreground p-8 md:p-16 text-center rounded-3xl">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Business?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Transform the way your business handles calls with AI-powered assistance that never misses a customer.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate("/signup")}
                className="text-lg px-8"
              >
                Get Started
              </Button>
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 gap-2 bg-primary-foreground/10 text-primary-foreground border-2 border-primary-foreground/40 hover:bg-primary-foreground/20"
                onClick={() => setContactOpen(true)}
              >
                <Headphones className="w-5 h-5" />
                Book a Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};

export default FinalCTA;
