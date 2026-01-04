import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Calculator, TrendingUp, PoundSterling } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

export const ROICalculatorDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ROI Calculator", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("See how AIVIA pays for itself", pageWidth / 2, 48, { align: "center" });
    
    // The Problem
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("The Cost of Missed Calls", 20, 65);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const problems = [
      "• Average missed calls per week: 5-10",
      "• Average booking value: £35",
      "• Customers who call competitors after voicemail: 80%",
    ];
    
    let yPos = 75;
    problems.forEach(p => {
      doc.text(p, 20, yPos);
      yPos += 7;
    });
    
    // Calculation Box
    doc.setFillColor(255, 240, 240);
    doc.rect(15, 100, pageWidth - 30, 50, "F");
    doc.setDrawColor(220, 100, 100);
    doc.rect(15, 100, pageWidth - 30, 50, "S");
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 50, 50);
    doc.text("Your Potential Lost Revenue", 20, 115);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const lostCalc = [
      "5 missed calls/week × £35 avg booking = £175/week lost",
      "£175/week × 52 weeks = £9,100/year in lost bookings",
      "Even at just 2 missed calls/week = £3,640/year lost",
    ];
    
    yPos = 125;
    lostCalc.forEach(calc => {
      doc.text(calc, 20, yPos);
      yPos += 10;
    });
    
    // Solution Box
    doc.setFillColor(240, 255, 240);
    doc.rect(15, 160, pageWidth - 30, 50, "F");
    doc.setDrawColor(100, 180, 100);
    doc.rect(15, 160, pageWidth - 30, 50, "S");
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 150, 50);
    doc.text("AIVIA Investment", 20, 175);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const investment = [
      "AIVIA monthly cost: ~£85/month",
      "AIVIA annual cost: ~£1,000/year",
      "Break-even: Just 2-3 recovered bookings per month",
    ];
    
    yPos = 185;
    investment.forEach(inv => {
      doc.text(inv, 20, yPos);
      yPos += 10;
    });
    
    // ROI Summary
    doc.setFillColor(245, 245, 255);
    doc.rect(15, 220, pageWidth - 30, 45, "F");
    doc.setDrawColor(139, 92, 246);
    doc.rect(15, 220, pageWidth - 30, 45, "S");
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Your Potential ROI", pageWidth / 2, 235, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Recovered revenue: £9,100 (if capturing 5 calls/week)", pageWidth / 2, 248, { align: "center" });
    doc.text("AIVIA cost: £1,000", pageWidth / 2, 256, { align: "center" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 150, 50);
    doc.text("Net gain: £8,100/year (810% ROI)", pageWidth / 2, 268, { align: "center" });
    
    // Footer
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 285, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 295, { align: "center" });
    
    doc.save("AIVIA-ROI-Calculator.pdf");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">ROI Calculator</CardTitle>
              <CardDescription>The money conversation made easy</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={generatePDF}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-yellow-600" />
              ROI & Break-Even Analysis
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Cost of missed calls</p>
              <p>• AIVIA investment breakdown</p>
              <p>• Break-even calculation</p>
              <p>• Potential annual savings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ROI Calculator - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border rounded-lg">
            {/* Header */}
            <div className="bg-primary text-primary-foreground rounded-lg p-6 text-center">
              <h1 className="text-2xl font-bold">ROI Calculator</h1>
              <p className="text-sm opacity-90 mt-1">See how AIVIA pays for itself</p>
            </div>
            
            {/* Problem */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold">The Cost of Missed Calls</h2>
              <div className="space-y-2 text-sm">
                <p>• Average missed calls per week: <strong>5-10</strong></p>
                <p>• Average booking value: <strong>£35</strong></p>
                <p>• Customers calling competitors after voicemail: <strong>80%</strong></p>
              </div>
            </div>
            
            {/* Lost Revenue */}
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 rotate-180" />
                Potential Lost Revenue
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <p>5 missed calls/week × £35 = <strong>£175/week</strong></p>
                <p>£175 × 52 weeks = <strong className="text-red-600">£9,100/year lost</strong></p>
                <p className="text-muted-foreground">Even at 2 calls/week = £3,640/year</p>
              </div>
            </div>
            
            {/* AIVIA Investment */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <PoundSterling className="h-5 w-5" />
                AIVIA Investment
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <p>Monthly cost: <strong>~£85/month</strong></p>
                <p>Annual cost: <strong>~£1,000/year</strong></p>
                <p className="text-green-600 dark:text-green-400 font-medium">Break-even: Just 2-3 recovered bookings/month</p>
              </div>
            </div>
            
            {/* ROI Summary */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 text-center">
              <h3 className="font-bold text-lg text-primary">Your Potential ROI</h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm">Recovered revenue: £9,100</p>
                <p className="text-sm">AIVIA cost: £1,000</p>
                <p className="text-2xl font-bold text-green-600 mt-3">
                  Net gain: £8,100/year
                </p>
                <p className="text-primary font-semibold">810% ROI</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={generatePDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
