import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import DemoDashboard from "./DemoDashboard";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="max-w-4xl mx-auto text-center">
        {/* Trust Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border mb-8">
          <Sparkles className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium">Trusted by UK Salons & Restaurants</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-foreground">
          Stop Losing Customers
          <br />
          <span className="text-muted-foreground">to Missed Calls</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          AI that answers your phone, books appointments, and takes orders — so you never miss another customer again.
        </p>

        {/* Risk Reducer Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary border border-border mb-8">
          <span className="text-sm text-muted-foreground">
            Free 14-day trial • No credit card required
          </span>
        </div>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")} 
            className="text-lg px-8 shadow-sm hover:shadow-md transition-shadow"
          >
            Start Free Trial
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="text-lg px-8 gap-2"
            onClick={() => {
              const demoSection = document.getElementById('demo-section');
              demoSection?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Play className="w-5 h-5" />
            Hear Demo Call
          </Button>
        </div>

        {/* Social Proof Bar */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-bold"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <span className="text-sm ml-2">Join <strong className="text-foreground">200+</strong> businesses already using AIVIA</span>
        </div>
      </div>

      {/* Interactive Demo Dashboard */}
      <DemoDashboard />
    </section>
  );
};

export default HeroSection;
