import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sparkles } from "lucide-react";
import { SalesPitchDocument } from "./sales-kit/SalesPitchDocument";
import { HowItWorksDocument } from "./sales-kit/HowItWorksDocument";
import { FeatureComparisonDocument } from "./sales-kit/FeatureComparisonDocument";
import { ROICalculatorDocument } from "./sales-kit/ROICalculatorDocument";
import { DemoScriptDocument } from "./sales-kit/DemoScriptDocument";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const AiviaSalesKitTab = () => {
  const downloadAllPDFs = () => {
    // Generate all PDFs one by one
    // Sales Pitch
    generateSalesPitchPDF();
    setTimeout(() => generateHowItWorksPDF(), 500);
    setTimeout(() => generateFeatureComparisonPDF(), 1000);
    setTimeout(() => generateROICalculatorPDF(), 1500);
    setTimeout(() => generateDemoScriptPDF(), 2000);
  };

  const generateSalesPitchPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("AIVIA", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("AI Voice Assistant for Businesses", pageWidth / 2, 30, { align: "center" });
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Never Miss Another Booking", pageWidth / 2, 60, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Your AI receptionist answers calls 24/7, books appointments, and remembers customers", pageWidth / 2, 70, { align: "center" });
    
    doc.save("AIVIA-Sales-Pitch.pdf");
  };

  const generateHowItWorksPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("How AIVIA Works", pageWidth / 2, 22, { align: "center" });
    
    doc.save("AIVIA-How-It-Works.pdf");
  };

  const generateFeatureComparisonPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Feature Comparison", pageWidth / 2, 22, { align: "center" });
    
    doc.save("AIVIA-Feature-Comparison.pdf");
  };

  const generateROICalculatorPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ROI Calculator", pageWidth / 2, 22, { align: "center" });
    
    doc.save("AIVIA-ROI-Calculator.pdf");
  };

  const generateDemoScriptPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Demo Script Guide", pageWidth / 2, 22, { align: "center" });
    
    doc.save("AIVIA-Demo-Script.pdf");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">AIVIA Sales Kit</CardTitle>
                <CardDescription>
                  All the documents you need for sales presentations
                </CardDescription>
              </div>
            </div>
            <Button onClick={downloadAllPDFs} className="gap-2">
              <Download className="h-4 w-4" />
              Download All PDFs
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quick Tips for Your Meeting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">Start with Pain</p>
              <p className="text-muted-foreground">Ask about missed calls before showing solutions</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">Demo the Voice</p>
              <p className="text-muted-foreground">Play a sample call - the AI voice sells itself</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">Close on ROI</p>
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
