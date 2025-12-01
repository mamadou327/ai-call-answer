import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface PolicyUploadProps {
  onPolicyExtracted: (policy: any) => void;
}

export const PolicyUpload = ({ onPolicyExtracted }: PolicyUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [extractedPolicy, setExtractedPolicy] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.includes("text") && !file.type.includes("pdf") && !file.type.includes("document")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a text, PDF, or document file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      
      const { data, error } = await supabase.functions.invoke("analyze-policy-document", {
        body: { documentText: text },
      });

      if (error) {
        console.error("Function invocation error:", error);
        throw new Error(error.message || "Failed to invoke analysis function");
      }

      console.log("Analysis response:", data);

      if (data?.success && data?.policies) {
        setExtractedPolicy(data.policies);
        toast({
          title: "Policy Extracted",
          description: "AI has analyzed your policy document. Review and apply below.",
        });
      } else {
        const errorMsg = data?.error || "No policy data returned from analysis";
        console.error("Analysis failed:", errorMsg, data);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Policy upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to analyze policy document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApply = () => {
    onPolicyExtracted(extractedPolicy);
    toast({
      title: "Success",
      description: "Policy data has been applied. Review and save your changes.",
    });
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload Policy Document
        </CardTitle>
        <CardDescription>
          Upload your policy document and let AI extract the information automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="policy_file">Policy Document</Label>
          <Input
            id="policy_file"
            type="file"
            onChange={handleFileUpload}
            accept=".txt,.pdf,.doc,.docx"
            disabled={uploading}
          />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing document...
            </div>
          )}
        </div>

        {extractedPolicy && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Extracted Policy</h3>
              <Button onClick={handleApply}>Apply to Form</Button>
            </div>

            <div className="space-y-2">
              <Label>Cancellation Policy</Label>
              <Textarea
                value={extractedPolicy.cancellation_policy}
                readOnly
                rows={6}
                className="bg-muted"
              />
            </div>

            {extractedPolicy.min_booking_notice_hours && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label>Min Booking Notice</Label>
                  <p className="font-semibold">{extractedPolicy.min_booking_notice_hours} hours</p>
                </div>
                <div>
                  <Label>Min Cancellation Notice</Label>
                  <p className="font-semibold">{extractedPolicy.min_cancellation_notice_hours} hours</p>
                </div>
                <div>
                  <Label>Max Days Advance</Label>
                  <p className="font-semibold">{extractedPolicy.max_days_advance} days</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
