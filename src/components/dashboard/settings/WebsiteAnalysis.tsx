import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WebsiteAnalysisProps {
  businessId: string;
  currentWebsite?: string;
  onAnalysisComplete: (data: any) => void;
}

export const WebsiteAnalysis = ({ businessId, currentWebsite, onAnalysisComplete }: WebsiteAnalysisProps) => {
  const { toast } = useToast();
  const [websiteUrl, setWebsiteUrl] = useState(currentWebsite || "");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!websiteUrl) {
      toast({
        title: "Error",
        description: "Please enter a website URL",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-website", {
        body: { websiteUrl },
      });

      if (error) throw error;

      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: "Analysis Complete",
          description: "AI has analyzed your website. Review and apply the findings below.",
        });
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (error: any) {
      console.error("Website analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze website",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = () => {
    onAnalysisComplete(analysis);
    toast({
      title: "Success",
      description: "Analysis data has been prepared for import. Check each section to review.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI Website Analysis
        </CardTitle>
        <CardDescription>
          Let AI analyze your website to automatically extract business information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website_url">Website URL</Label>
          <div className="flex gap-2">
            <Input
              id="website_url"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourbusiness.com"
            />
            <Button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </div>
        </div>

        {analysis && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Analysis Results</h3>
              <Button onClick={handleApply}>Apply to Business</Button>
            </div>

            <Tabs defaultValue="staff">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="staff">Staff ({analysis.staff?.length || 0})</TabsTrigger>
                <TabsTrigger value="services">Services ({analysis.services?.length || 0})</TabsTrigger>
                <TabsTrigger value="hours">Hours</TabsTrigger>
                <TabsTrigger value="policies">Policies</TabsTrigger>
              </TabsList>

              <TabsContent value="staff" className="space-y-2">
                {analysis.staff?.map((member: any, index: number) => (
                  <div key={index} className="p-3 border rounded">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                ))}
                {(!analysis.staff || analysis.staff.length === 0) && (
                  <p className="text-sm text-muted-foreground">No staff found</p>
                )}
              </TabsContent>

              <TabsContent value="services" className="space-y-2">
                {analysis.services?.map((service: any, index: number) => (
                  <div key={index} className="p-3 border rounded">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    <p className="text-sm">
                      {service.duration_minutes} mins • £{service.price}
                    </p>
                  </div>
                ))}
                {(!analysis.services || analysis.services.length === 0) && (
                  <p className="text-sm text-muted-foreground">No services found</p>
                )}
              </TabsContent>

              <TabsContent value="hours" className="space-y-2">
                {analysis.opening_hours?.map((hour: any, index: number) => (
                  <div key={index} className="p-3 border rounded flex justify-between">
                    <span>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][hour.day]}</span>
                    <span>
                      {hour.is_closed ? "Closed" : `${hour.open_time} - ${hour.close_time}`}
                    </span>
                  </div>
                ))}
                {(!analysis.opening_hours || analysis.opening_hours.length === 0) && (
                  <p className="text-sm text-muted-foreground">No hours found</p>
                )}
              </TabsContent>

              <TabsContent value="policies">
                <div className="p-3 border rounded space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{analysis.policies?.cancellation_policy || "No policy found"}</p>
                  {analysis.policies?.min_booking_notice_hours && (
                    <p className="text-sm">Min booking notice: {analysis.policies.min_booking_notice_hours} hours</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
