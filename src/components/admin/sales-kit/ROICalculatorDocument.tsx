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
    
    // Header - Black neobrutalist style
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ROI CALCULATOR", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("See how AIVIA pays for itself", pageWidth / 2, 48, { align: "center" });
    
    // The Problem
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("THE COST OF MISSED CALLS", 20, 65);
    doc.setLineWidth(2);
    doc.line(20, 68, 100, 68);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const problems = [
      "• Average missed calls per week: 5-10",
      "• Average booking value: £35",
      "• Customers who call competitors after voicemail: 80%",
    ];
    
    let yPos = 78;
    problems.forEach(p => {
      doc.text(p, 20, yPos);
      yPos += 8;
    });
    
    // Lost Revenue Box - black bordered
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.setFillColor(255, 255, 255);
    doc.rect(15, 100, pageWidth - 30, 50, "FD");
    
    // Black header inside box
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 100, pageWidth - 30, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("POTENTIAL LOST REVENUE", 20, 108);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const lostCalc = [
      "5 missed calls/week × £35 avg booking = £175/week lost",
      "£175/week × 52 weeks = £9,100/year in lost bookings",
      "Even at just 2 missed calls/week = £3,640/year lost",
    ];
    
    yPos = 122;
    lostCalc.forEach(calc => {
      doc.text(calc, 20, yPos);
      yPos += 10;
    });
    
    // AIVIA Investment Box - black filled header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.setFillColor(255, 255, 255);
    doc.rect(15, 160, pageWidth - 30, 50, "FD");
    
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 160, pageWidth - 30, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("AIVIA INVESTMENT", 20, 168);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const investment = [
      "AIVIA monthly cost: ~£85/month",
      "AIVIA annual cost: ~£1,000/year",
      "Break-even: Just 2-3 recovered bookings per month",
    ];
    
    yPos = 182;
    investment.forEach(inv => {
      doc.text(inv, 20, yPos);
      yPos += 10;
    });
    
    // ROI Summary - fully black box
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 220, pageWidth - 30, 50, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("YOUR POTENTIAL ROI", pageWidth / 2, 235, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Recovered revenue: £9,100 (capturing 5 calls/week)", pageWidth / 2, 248, { align: "center" });
    doc.text("AIVIA cost: £1,000", pageWidth / 2, 256, { align: "center" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("NET GAIN: £8,100/YEAR (810% ROI)", pageWidth / 2, 268, { align: "center" });
    
    // Footer
    doc.setFillColor(0, 0, 0);
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
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-[6px_6px_0px_0px_hsl(var(--foreground))] transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">ROI Calculator</CardTitle>
              <CardDescription>The money conversation made easy</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="border-2 border-foreground" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-2 border-foreground" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-2 border-foreground" onClick={generatePDF}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted border-2 border-foreground p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Calculator className="h-4 w-4" />
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
            <DialogTitle className="font-bold">ROI Calculator - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border-2 border-foreground">
            {/* Header */}
            <div className="bg-foreground text-background p-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">ROI CALCULATOR</h1>
              <p className="text-sm opacity-90 mt-1">See how AIVIA pays for itself</p>
            </div>
            
            {/* Problem */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b-2 border-foreground pb-2">THE COST OF MISSED CALLS</h2>
              <div className="space-y-2 text-sm">
                <p>• Average missed calls per week: <strong>5-10</strong></p>
                <p>• Average booking value: <strong>£35</strong></p>
                <p>• Customers calling competitors after voicemail: <strong>80%</strong></p>
              </div>
            </div>
            
            {/* Lost Revenue */}
            <div className="border-2 border-foreground">
              <div className="bg-foreground text-background p-3">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 rotate-180" />
                  POTENTIAL LOST REVENUE
                </h3>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <p>5 missed calls/week × £35 = <strong>£175/week</strong></p>
                <p>£175 × 52 weeks = <strong>£9,100/year lost</strong></p>
                <p className="text-muted-foreground">Even at 2 calls/week = £3,640/year</p>
              </div>
            </div>
            
            {/* AIVIA Investment */}
            <div className="border-2 border-foreground">
              <div className="bg-foreground text-background p-3">
                <h3 className="font-bold flex items-center gap-2">
                  <PoundSterling className="h-5 w-5" />
                  AIVIA INVESTMENT
                </h3>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <p>Monthly cost: <strong>~£85/month</strong></p>
                <p>Annual cost: <strong>~£1,000/year</strong></p>
                <p className="font-bold">Break-even: Just 2-3 recovered bookings/month</p>
              </div>
            </div>
            
            {/* ROI Summary */}
            <div className="bg-foreground text-background p-6 text-center">
              <h3 className="font-bold text-lg">YOUR POTENTIAL ROI</h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm">Recovered revenue: £9,100</p>
                <p className="text-sm">AIVIA cost: £1,000</p>
                <p className="text-2xl font-bold mt-3">
                  NET GAIN: £8,100/YEAR
                </p>
                <p className="font-bold">810% ROI</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" className="border-2 border-foreground" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={generatePDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};