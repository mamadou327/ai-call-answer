import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ContactDialog from "./ContactDialog";
import { TIER_ORDER, TIERS } from "@/lib/tiers";

const PricingSection = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <section id="pricing" className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pick the plan that fits your call volume. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {TIER_ORDER.map((id) => {
            const plan = TIERS[id];
            const isEnterprise = id === "enterprise";

            return (
              <Card
                key={id}
                className={`relative border-2 flex flex-col ${
                  plan.popular
                    ? "border-primary shadow-lg lg:scale-105"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-4 min-h-[3rem] flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{plan.priceLabel}</span>
                    {plan.priceSuffix && (
                      <span className="text-sm text-muted-foreground">
                        {plan.priceSuffix}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col">
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() =>
                      isEnterprise ? setContactOpen(true) : navigate("/signup")
                    }
                  >
                    {plan.ctaLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a free trial. No credit card required to get started.
        </p>
      </section>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};

export default PricingSection;
