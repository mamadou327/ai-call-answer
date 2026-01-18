import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Headphones } from "lucide-react";
import DemoDashboard from "./DemoDashboard";
import HowItWorksDialog from "@/components/HowItWorksDialog";
import DemoRequestDialog from "./DemoRequestDialog";
import { FeatureCarousel } from "./FeatureCarousel";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-4 py-10 md:py-16">
      <div className="max-w-4xl mx-auto text-center">

        {/* Main Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 text-foreground">
          Every Call Answered.
          <br />
          <span className="text-muted-foreground">Every Order Taken. Every Table Booked.</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
          Your 24/7 AI phone assistant handling unlimited calls at once, taking orders and reservations so no customer is ever on hold.
        </p>

        {/* Demo CTA Badge */}
        <DemoRequestDialog>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-md mb-6 cursor-pointer hover:bg-secondary/80 transition-colors">
            <Headphones className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Want to hear how it works? <span className="text-primary font-medium">Click here</span>
            </span>
          </button>
        </DemoRequestDialog>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")} 
            className="text-lg px-8 shadow-sm hover:shadow-md transition-shadow"
          >
            Start Free Trial
          </Button>
          <HowItWorksDialog>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 gap-2"
            >
              <Play className="w-5 h-5" />
              See How It Works
            </Button>
          </HowItWorksDialog>
        </div>

      </div>

      {/* Interactive Demo Dashboard */}
      <DemoDashboard />

      {/* Feature Carousel */}
      <FeatureCarousel />
    </section>
  );
};

export default HeroSection;
