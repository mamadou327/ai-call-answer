import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Calculator, TrendingUp, PoundSterling } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import aiviaLogo from "@/assets/aivia-logo-new.png";

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
};

export const generateROICalculatorPdf = async () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header: white background, black title, logo top-left
  const headerHeight = 18;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(0, headerHeight, pageWidth, headerHeight);

  // Add logo (with fallback)
  try {
    const logoData = await loadImageAsBase64(aiviaLogo);
    doc.addImage(logoData, "PNG", 8, 2, 14, 14);
  } catch (e) {
    // Continue without logo
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("ROI CALCULATOR", pageWidth / 2, 12, { align: "center" });

  // Subtitle
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("See how AIVIA pays for itself", pageWidth / 2, 28, { align: "center" });

  let yPos = 42;

  // The Problem Section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("THE COST OF MISSED CALLS", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 80, yPos + 2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const problems = [
    "  - Average missed calls per week: 5-10",
    "  - Average booking value: £35",
    "  - Customers who call competitors after voicemail: 80%",
  ];

  yPos += 10;
  problems.forEach((p) => {
    doc.text(p, 20, yPos);
    yPos += 7;
  });

  // Lost Revenue Box - white with border, black title badge
  yPos += 8;
  const lostY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, lostY, pageWidth - 30, 42, "S");

  // Black title badge
  doc.setFillColor(0, 0, 0);
  doc.rect(20, lostY + 4, 70, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("POTENTIAL LOST REVENUE", 23, lostY + 9);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const lostCalc = [
    "5 missed calls/week x £35 avg booking = £175/week lost",
    "£175/week x 52 weeks = £9,100/year in lost bookings",
    "Even at just 2 missed calls/week = £3,640/year lost",
  ];

  yPos = lostY + 22;
  lostCalc.forEach((calc) => {
    doc.text(calc, 20, yPos);
    yPos += 8;
  });

  // AIVIA Investment Box
  yPos = lostY + 52;
  const investY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, investY, pageWidth - 30, 42, "S");

  // Black title badge
  doc.setFillColor(0, 0, 0);
  doc.rect(20, investY + 4, 55, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("AIVIA INVESTMENT", 23, investY + 9);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const investment = [
    "AIVIA monthly cost: ~£85/month",
    "AIVIA annual cost: ~£1,000/year",
    "Break-even: Just 2-3 recovered bookings per month",
  ];

  yPos = investY + 22;
  investment.forEach((inv) => {
    doc.text(inv, 20, yPos);
    yPos += 8;
  });

  // ROI Summary Box - white with border and bold text
  yPos = investY + 55;
  const roiY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(15, roiY, pageWidth - 30, 45, "S");

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("YOUR POTENTIAL ROI", pageWidth / 2, roiY + 12, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Recovered revenue: £9,100 (capturing 5 calls/week)", pageWidth / 2, roiY + 22, { align: "center" });
  doc.text("AIVIA cost: £1,000", pageWidth / 2, roiY + 29, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("NET GAIN: £8,100/YEAR (810% ROI)", pageWidth / 2, roiY + 40, { align: "center" });

  // Clean footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });

  doc.save("AIVIA-ROI-Calculator.pdf");
};

export const ROICalculatorDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = () => {
    void generateROICalculatorPdf();
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
          <div className="space-y-6 p-4 bg-background border border-foreground/20">
            {/* Header */}
            <div className="border-b border-foreground pb-3">
              <h1 className="text-xl font-bold tracking-tight">ROI CALCULATOR</h1>
              <p className="text-sm text-muted-foreground mt-1">See how AIVIA pays for itself</p>
            </div>
            
            {/* Problem */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b border-foreground/30 pb-2">THE COST OF MISSED CALLS</h2>
              <div className="space-y-2 text-sm">
                <p>• Average missed calls per week: <strong>5-10</strong></p>
                <p>• Average booking value: <strong>£35</strong></p>
                <p>• Customers calling competitors after voicemail: <strong>80%</strong></p>
              </div>
            </div>
            
            {/* Lost Revenue */}
            <div className="border border-foreground/30">
              <div className="inline-block bg-foreground text-background px-2 py-1 text-xs font-bold m-3 mb-0">
                POTENTIAL LOST REVENUE
              </div>
              <div className="p-4 pt-2 space-y-2 text-sm">
                <p>5 missed calls/week × £35 = <strong>£175/week</strong></p>
                <p>£175 × 52 weeks = <strong>£9,100/year lost</strong></p>
                <p className="text-muted-foreground">Even at 2 calls/week = £3,640/year</p>
              </div>
            </div>
            
            {/* AIVIA Investment */}
            <div className="border border-foreground/30">
              <div className="inline-block bg-foreground text-background px-2 py-1 text-xs font-bold m-3 mb-0">
                AIVIA INVESTMENT
              </div>
              <div className="p-4 pt-2 space-y-2 text-sm">
                <p>Monthly cost: <strong>~£85/month</strong></p>
                <p>Annual cost: <strong>~£1,000/year</strong></p>
                <p className="font-bold">Break-even: Just 2-3 recovered bookings/month</p>
              </div>
            </div>
            
            {/* ROI Summary */}
            <div className="border-2 border-foreground p-6 text-center">
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