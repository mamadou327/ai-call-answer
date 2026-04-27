import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { TIER_ORDER, TIERS } from "@/lib/tiers";
import ContactDialog from "./ContactDialog";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PricingDialog = ({ open, onOpenChange }: PricingDialogProps) => {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pricing</DialogTitle>
            <DialogDescription>
              Pick the plan that fits your call volume. Upgrade or downgrade anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 py-4">
            {TIER_ORDER.map((id) => {
              const plan = TIERS[id];
              const isEnterprise = id === "enterprise";

              return (
                <div
                  key={id}
                  className={`relative rounded-lg border-2 p-4 flex flex-col ${
                    plan.popular ? "border-primary shadow-md" : "border-border"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="text-center pb-2">
                    <h3 className="font-bold">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <span className="text-2xl font-bold">{plan.priceLabel}</span>
                      {plan.priceSuffix && (
                        <span className="text-xs text-muted-foreground">
                          {plan.priceSuffix}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-1.5 my-4 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="sm"
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => {
                      if (isEnterprise) {
                        onOpenChange(false);
                        setContactOpen(true);
                      } else {
                        onOpenChange(false);
                        navigate("/signup");
                      }
                    }}
                  >
                    {plan.ctaLabel}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            All plans include a free trial. No credit card required to get started.
          </p>
        </DialogContent>
      </Dialog>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};

export default PricingDialog;
