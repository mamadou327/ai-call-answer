import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock } from "lucide-react";

interface Props {
  formData: any;
  updateFormData: (updates: any) => void;
  onBack: () => void;
  businessId: string | null;
}

const OnboardingStep5 = ({ onBack, businessId }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      if (!businessId) throw new Error("Business ID not found");

      // Get business and user details
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("*, owner_id")
        .eq("id", businessId)
        .single();

      if (businessError) throw businessError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user.id)
        .single();

      // Mark business as pending
      const { error } = await supabase
        .from("businesses")
        .update({ status: "pending" })
        .eq("id", businessId);

      if (error) throw error;

      // Send notification to super admin
      try {
        console.log("Sending admin notification email...");
        const { error: emailError } = await supabase.functions.invoke("send-admin-notification", {
          body: {
            businessName: business.business_name,
            ownerName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown',
            ownerEmail: profile?.email || user.email || 'Unknown',
            phone: business.main_phone,
            website: business.website || undefined,
            address: business.address,
          },
        });

        if (emailError) {
          console.error("Failed to send admin notification email:", emailError);
          // Don't throw - we still want to proceed even if email fails
        } else {
          console.log("Admin notification email sent successfully");
        }
      } catch (emailError) {
        console.error("Error sending admin notification:", emailError);
        // Continue anyway
      }

      toast({
        title: "Application submitted!",
        description: "We'll review your application and get back to you soon.",
      });

      navigate("/pending-approval");
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
        <CardTitle>Submit Your Application</CardTitle>
        <CardDescription>Review and submit your Aivia application for approval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold">Personal Information</h4>
              <p className="text-sm text-muted-foreground">Your profile has been created</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold">Business Information</h4>
              <p className="text-sm text-muted-foreground">Your business details have been saved</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold">Staff Count</h4>
              <p className="text-sm text-muted-foreground">Team size configured</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold">Phone Number</h4>
              <p className="text-sm text-muted-foreground">Number selection completed</p>
            </div>
          </div>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-accent shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold text-accent">What happens next?</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Our team will review your application</li>
                <li>We'll verify your business information</li>
                <li>You'll receive an email or phone call within 1-2 business days</li>
                <li>Once approved, you can start using Aivia immediately</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnboardingStep5;