import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  formData: {
    businessName: string;
    mainPhone: string;
    secondaryPhone: string;
    address: string;
    website: string;
  };
  businessType: string;
  updateFormData: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
  userId: string;
  businessId: string | null;
  setBusinessId: (id: string) => void;
}

const OnboardingStep2 = ({ formData, businessType, updateFormData, onNext, onBack, userId, businessId, setBusinessId }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const businessData = {
        owner_id: userId,
        business_name: formData.businessName,
        main_phone: formData.mainPhone,
        secondary_phone: formData.secondaryPhone || null,
        address: formData.address,
        website: formData.website || null,
        website_knowledge: formData.website ? "Mock AI has learned about your services, pricing, and business hours from your website." : null,
        staff_count: 1,
        business_type: businessType,
      };

      if (businessId) {
        const { error } = await supabase
          .from("businesses")
          .update(businessData)
          .eq("id", businessId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("businesses")
          .insert(businessData)
          .select()
          .single();

        if (error) throw error;
        if (data) setBusinessId(data.id);
      }

      if (formData.website) {
        setShowKnowledge(true);
        setTimeout(() => {
          onNext();
        }, 2000);
      } else {
        onNext();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Tell us about your business</CardTitle>
        <CardDescription>This helps Aivia provide better service to your customers</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) => updateFormData({ businessName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mainPhone">Main Phone Number *</Label>
            <Input
              id="mainPhone"
              type="tel"
              value={formData.mainPhone}
              onChange={(e) => updateFormData({ mainPhone: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryPhone">Secondary Phone (Optional)</Label>
            <Input
              id="secondaryPhone"
              type="tel"
              value={formData.secondaryPhone}
              onChange={(e) => updateFormData({ secondaryPhone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Business Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => updateFormData({ address: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website (Optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourbusiness.com"
              value={formData.website}
              onChange={(e) => updateFormData({ website: e.target.value })}
            />
            {formData.website && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                Aivia will learn from your website
              </p>
            )}
          </div>

          {showKnowledge && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <h4 className="font-semibold text-accent mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                What Aivia has learned
              </h4>
              <p className="text-sm text-muted-foreground">
                Mock AI has extracted information about your services, pricing, and business hours from your website. This will help provide accurate information to your customers.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OnboardingStep2;