import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ContactDialog from "./ContactDialog";

const PricingSection = () => {
  const [contactOpen, setContactOpen] = useState(false);

  const plans = [
    {
      name: "Starter",
      description: "Perfect for small businesses just getting started",
      features: [
        "AI receptionist 24/7",
        "Booking & ordering capabilities",
        "SMS confirmations",
        "Call transcripts",
        "Basic analytics",
        "Email support"
      ],
      popular: false
    },
    {
      name: "Pro",
      description: "For growing businesses that need more",
      features: [
        "Everything in Starter",
        "Priority phone support",
        "Advanced analytics",
        "CRM integrations",
        "Custom voice settings",
        "Multi-staff scheduling"
      ],
      popular: true
    },
    {
      name: "Business",
      description: "For high-volume businesses",
      features: [
        "Everything in Pro",
        "Custom voice training",
        "White-glove setup",
        "Multi-location support",
        "Dedicated account manager",
        "API access"
      ],
      popular: false
    }
  ];

  return (
    <>
      <section id="pricing" className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Flexible Pricing for Every Business</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We tailor pricing based on your needs, volume, and requirements. Get in touch for a custom quote.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative border-2 ${
                plan.popular 
                  ? 'border-primary shadow-lg scale-105' 
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-sm font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-muted-foreground">Custom Pricing</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-success shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button 
            size="lg"
            onClick={() => setContactOpen(true)} 
            className="px-8"
          >
            Get in Touch for Custom Pricing
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            No commitment required. We'll find the perfect plan for your business.
          </p>
        </div>
      </section>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};

export default PricingSection;
