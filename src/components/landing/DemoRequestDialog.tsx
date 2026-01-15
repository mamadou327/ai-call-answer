import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Headphones } from "lucide-react";
import { z } from "zod";

const demoRequestSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  businessName: z.string().trim().max(100, "Business name must be less than 100 characters").optional(),
  businessType: z.string().optional(),
  message: z.string().trim().max(1000, "Message must be less than 1000 characters").optional(),
});

interface DemoRequestDialogProps {
  children: React.ReactNode;
}

const DemoRequestDialog = ({ children }: DemoRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    businessType: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = demoRequestSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0]?.message || "Please check your input",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert into database
      const { error: dbError } = await supabase
        .from("demo_requests")
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          business_name: formData.businessName.trim() || null,
          business_type: formData.businessType || null,
          message: formData.message.trim() || null,
        });

      if (dbError) throw dbError;

      // Send admin notification email
      const { error: emailError } = await supabase.functions.invoke("send-demo-request-notification", {
        body: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          businessName: formData.businessName.trim() || undefined,
          businessType: formData.businessType || undefined,
          message: formData.message.trim() || undefined,
        },
      });

      if (emailError) {
        console.error("Email notification failed:", emailError);
        // Don't fail the submission if email fails
      }

      setSubmitted(true);
      toast({
        title: "Request Submitted!",
        description: "We'll be in touch soon to schedule your demo.",
      });
    } catch (error: any) {
      console.error("Error submitting demo request:", error);
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset form when closing
      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          businessName: "",
          businessType: "",
          message: "",
        });
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Headphones className="w-8 h-8 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Thank You!</DialogTitle>
              <DialogDescription className="text-center">
                We've received your request and will reach out shortly to schedule your personalized demo call.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="mt-6">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request a Demo Call</DialogTitle>
              <DialogDescription>
                Fill in your details and we'll call you to demonstrate how Aivia can transform your business.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Your business name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) => setFormData({ ...formData, businessType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="salon">Salon / Barbershop</SelectItem>
                    <SelectItem value="spa">Spa / Wellness</SelectItem>
                    <SelectItem value="clinic">Clinic / Medical</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your needs..."
                  rows={3}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Request Demo Call"
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoRequestDialog;
