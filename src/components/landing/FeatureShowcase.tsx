import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, BarChart3, Check } from "lucide-react";

const FeatureShowcase = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Clock,
      title: "24/7 Availability",
      headline: "Never Miss Another Customer Call",
      description: "AIVIA answers every call instantly, whether it's 3pm or 3am. No more lost bookings during busy periods, lunch breaks, or after hours.",
      benefits: [
        "Answers instantly, any time of day",
        "Handles multiple calls simultaneously",
        "No holidays or sick days",
        "Speaks naturally in your brand voice"
      ],
      imagePosition: "right" as const
    },
    {
      icon: Calendar,
      title: "Smart Booking",
      headline: "Books Appointments & Takes Orders",
      description: "Your AI assistant knows your schedule, menu, and availability in real-time. It handles the entire booking or ordering process professionally.",
      benefits: [
        "Checks real-time availability",
        "Knows your menu/services inside out",
        "Calculates prices accurately",
        "Sends instant confirmations"
      ],
      imagePosition: "left" as const
    },
    {
      icon: BarChart3,
      title: "Analytics",
      headline: "Track Everything in One Place",
      description: "See every call, booking, and order in your dashboard. Understand your business better with detailed analytics and call transcripts.",
      benefits: [
        "View all calls and bookings",
        "Track revenue automatically",
        "Monitor staff performance",
        "Access full call transcripts"
      ],
      imagePosition: "right" as const
    }
  ];

  return (
    <section id="features" className="container mx-auto px-4 py-16 md:py-24">
      <div className="space-y-24">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`flex flex-col ${
              feature.imagePosition === 'left' ? 'md:flex-row-reverse' : 'md:flex-row'
            } gap-12 items-center`}
          >
            {/* Text Content */}
            <div className="flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted border border-border text-sm font-medium mb-4">
                <feature.icon className="w-4 h-4" />
                {feature.title}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">{feature.headline}</h3>
              <p className="text-muted-foreground text-lg mb-6">{feature.description}</p>
              <ul className="space-y-3 mb-8">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-success shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => navigate("/auth")} className="shadow-sm">
                Start Free Trial
              </Button>
            </div>

            {/* Visual Placeholder */}
            <div className="flex-1 w-full max-w-lg">
              <div className="aspect-[4/3] bg-muted border-2 border-border flex items-center justify-center">
                <div className="text-center p-8">
                  <feature.icon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Dashboard Preview</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeatureShowcase;
