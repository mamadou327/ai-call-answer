import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  formData: { staffCount: number };
  updateFormData: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
  businessId: string | null;
}

const OnboardingStep3 = ({ formData, updateFormData, onNext, onBack, businessId }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!businessId) throw new Error("Business ID not found");

      const { error } = await supabase
        .from("businesses")
        .update({ staff_count: formData.staffCount })
        .eq("id", businessId);

      if (error) throw error;

      onNext();
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
        <CardTitle>How many staff members do you have?</CardTitle>
        <CardDescription>This helps us optimize scheduling for your team</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staffCount">Number of Staff Members *</Label>
            <Input
              id="staffCount"
              type="number"
              min="1"
              value={formData.staffCount}
              onChange={(e) => updateFormData({ staffCount: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

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

export default OnboardingStep3;