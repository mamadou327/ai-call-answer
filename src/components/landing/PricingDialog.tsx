import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PricingDialog = ({ open, onOpenChange }: PricingDialogProps) => {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    businessName: "",
    phone: "",
    message: ""
  });

  const includedFeatures = [
    "AI-powered phone answering",
    "24/7 availability",
    "Smart booking & scheduling",
    "SMS confirmations & reminders",
    "Call analytics & insights",
    "Custom voice & branding",
    "Dashboard access",
    "Dedicated support"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success("Thanks! We'll be in touch within 24 hours with pricing details.");
    setFormData({ name: "", email: "", businessName: "", phone: "", message: "" });
    setIsSubmitting(false);
    setShowForm(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    setShowForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) setShowForm(false);
    }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {showForm ? "Get Pricing" : "Pricing"}
          </DialogTitle>
          <DialogDescription>
            {showForm 
              ? "Tell us about your business and we'll create a custom quote"
              : "Tailored pricing for your business needs"
            }
          </DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <div className="py-4 space-y-6">
            <p className="text-muted-foreground">
              We offer flexible pricing based on your business size and call volume. 
              Every plan includes everything you need to transform your customer communications.
            </p>

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">What's included:</h4>
              <ul className="grid gap-2">
                {includedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              onClick={() => setShowForm(true)} 
              className="w-full"
              size="lg"
            >
              Get in Touch for Pricing
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pricing-name">Name *</Label>
              <Input
                id="pricing-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-email">Email *</Label>
              <Input
                id="pricing-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-business">Business Name *</Label>
              <Input
                id="pricing-business"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-phone">Phone (optional)</Label>
              <Input
                id="pricing-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-message">Tell us about your business (optional)</Label>
              <Textarea
                id="pricing-message"
                rows={3}
                placeholder="e.g. type of business, estimated call volume..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PricingDialog;
