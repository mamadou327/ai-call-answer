import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check } from "lucide-react";

const PricingSection = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "£49",
      period: "/month",
      description: "Perfect for small businesses just getting started",
      minutes: "100 minutes included",
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
      price: "£99",
      period: "/month",
      description: "For growing businesses that need more",
      minutes: "250 minutes included",
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
      price: "£199",
      period: "/month",
      description: "For high-volume businesses",
      minutes: "500+ minutes included",
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
    <section id="pricing" className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          No hidden fees. No contracts. Cancel anytime.
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
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              <div className="mt-4 py-2 bg-muted text-sm font-medium">
                {plan.minutes}
              </div>
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
              <Button 
                onClick={() => navigate("/auth")} 
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Need more minutes? Additional minutes available at £0.15/min
      </p>
    </section>
  );
};

export default PricingSection;
