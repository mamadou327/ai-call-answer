import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sparkles } from "lucide-react";
import { SalesPitchDocument, generateSalesPitchPdf } from "./sales-kit/SalesPitchDocument";
import { HowItWorksDocument, generateHowItWorksPdf } from "./sales-kit/HowItWorksDocument";
import { FeatureComparisonDocument, generateFeatureComparisonPdf } from "./sales-kit/FeatureComparisonDocument";
import { ROICalculatorDocument, generateROICalculatorPdf } from "./sales-kit/ROICalculatorDocument";
import { DemoScriptDocument, generateDemoScriptPdf } from "./sales-kit/DemoScriptDocument";

export const AiviaSalesKitTab = () => {
  const downloadAllPDFs = () => {
    // Note: multiple downloads may be throttled by the browser; we stagger them slightly.
    void generateSalesPitchPdf();
    setTimeout(() => void generateHowItWorksPdf(), 600);
    setTimeout(() => void generateFeatureComparisonPdf(), 1200);
    setTimeout(() => void generateROICalculatorPdf(), 1800);
    setTimeout(() => void generateDemoScriptPdf(), 2400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-foreground text-background">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">AIVIA SALES KIT</CardTitle>
                <CardDescription>
                  All the documents you need for sales presentations
                </CardDescription>
              </div>
            </div>
            <Button onClick={downloadAllPDFs} className="gap-2 bg-foreground text-background hover:bg-foreground/90 border-2 border-foreground">
              <Download className="h-4 w-4" />
              Download All PDFs
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Tips */}
      <Card className="border-2 border-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            QUICK TIPS FOR YOUR MEETING
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Start with Pain</p>
              <p className="text-muted-foreground">Ask about missed calls before showing solutions</p>
            </div>
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Demo the Voice</p>
              <p className="text-muted-foreground">Play a sample call - the AI voice sells itself</p>
            </div>
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Close on ROI</p>
              <p className="text-muted-foreground">"One booking pays for the month"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SalesPitchDocument />
        <HowItWorksDocument />
        <FeatureComparisonDocument />
        <ROICalculatorDocument />
        <DemoScriptDocument />
      </div>
    </div>
  );
};