import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Headphones } from "lucide-react";

const FinalCTA = () => {
  const navigate = useNavigate();

  const trustPoints = [
    "Free 14-day trial",
    "No credit card required",
    "Cancel anytime"
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="bg-primary text-primary-foreground p-8 md:p-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Join 200+ UK salons and restaurants using AIVIA to grow their business and never miss a customer again.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2"
              onClick={() => {
                const demoSection = document.getElementById('demo-section');
                demoSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Headphones className="w-5 h-5" />
              Book a Demo
            </Button>
          </div>

          {/* Trust Points */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {trustPoints.map((point, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-primary-foreground/80">
                <Check className="w-4 h-4" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
