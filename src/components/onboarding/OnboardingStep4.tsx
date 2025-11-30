import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  formData: { numberSelection: "aivia_provided" | "port_existing" | "do_later" };
  updateFormData: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
  businessId: string | null;
}

const OnboardingStep4 = ({ formData, updateFormData, onNext, onBack, businessId }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Mock file upload - in production, upload to storage
    const fileNames = Array.from(files).map(f => f.name);
    setUploadedFiles(prev => [...prev, ...fileNames]);

    toast({
      title: "Files uploaded",
      description: "Your documents have been saved",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!businessId) throw new Error("Business ID not found");

      const { error } = await supabase
        .from("business_number_selection")
        .upsert({
          business_id: businessId,
          selection_type: formData.numberSelection,
          document_urls: uploadedFiles.length > 0 ? uploadedFiles : null,
        });

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
        <CardTitle>Choose your phone number option</CardTitle>
        <CardDescription>Select how you'd like to set up your Aivia number</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup
            value={formData.numberSelection}
            onValueChange={(value: any) => updateFormData({ numberSelection: value })}
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:border-primary transition-colors">
              <RadioGroupItem value="aivia_provided" id="aivia" />
              <div className="flex-1">
                <Label htmlFor="aivia" className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Get an Aivia-provided number (Recommended)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fastest setup. Get started immediately with a new phone number.
                  </p>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:border-primary transition-colors">
              <RadioGroupItem value="port_existing" id="port" />
              <div className="flex-1">
                <Label htmlFor="port" className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="w-5 h-5 text-secondary" />
                    <span className="font-semibold">Port my existing number</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Keep your current phone number. Requires documentation.
                  </p>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:border-primary transition-colors">
              <RadioGroupItem value="do_later" id="later" />
              <div className="flex-1">
                <Label htmlFor="later" className="cursor-pointer">
                  <span className="font-semibold">I'll do this later</span>
                  <p className="text-sm text-muted-foreground">
                    Complete your application and set up the number later.
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>

          {formData.numberSelection === "port_existing" && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="documents">Upload Required Documents</Label>
              <Input
                id="documents"
                type="file"
                multiple
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {uploadedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Uploaded files:</p>
                  <ul className="text-sm list-disc list-inside">
                    {uploadedFiles.map((file, i) => (
                      <li key={i}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}
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

export default OnboardingStep4;