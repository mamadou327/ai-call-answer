import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, X, CheckCircle2, Phone, Clock, Users, Calendar, MessageSquare } from "lucide-react";
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

export const SalesPitchDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Load and add logo
    try {
      const logoData = await loadImageAsBase64(aiviaLogo);
      doc.addImage(logoData, "PNG", 15, 8, 24, 24);
    } catch (e) {
      console.error("Failed to load logo:", e);
    }
    
    // Header - Black neobrutalist style
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    // Re-add logo on top of black header (white version would be ideal, but we'll use what we have)
    try {
      const logoData = await loadImageAsBase64(aiviaLogo);
      doc.addImage(logoData, "PNG", 15, 8, 24, 24);
    } catch (e) {
      console.error("Failed to load logo:", e);
    }
    
    // Title - positioned to the right of logo
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("AIVIA", pageWidth / 2 + 10, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("AI Voice Assistant for Businesses", pageWidth / 2 + 10, 30, { align: "center" });
    
    // Main headline
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("NEVER MISS ANOTHER BOOKING", pageWidth / 2, 60, { align: "center" });
    
    // Subheadline
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Your AI receptionist answers calls 24/7, books appointments, and remembers customers", pageWidth / 2, 70, { align: "center" });
    
    // Pain Points Section with black border box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(15, 80, (pageWidth - 35) / 2, 55, "S");
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("THE PROBLEM", 20, 92);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const painPoints = [
      "✗ Missing calls = Missing money",
      "✗ 80% won't leave voicemail",
      "✗ Receptionist costs £20,000+/yr",
      "✗ Too busy with clients to answer"
    ];
    let yPos = 102;
    painPoints.forEach(point => {
      doc.text(point, 20, yPos);
      yPos += 8;
    });
    
    // Solution Section with filled black header
    const solutionX = 20 + (pageWidth - 35) / 2;
    doc.rect(solutionX, 80, (pageWidth - 35) / 2, 55, "S");
    
    doc.setFillColor(0, 0, 0);
    doc.rect(solutionX, 80, (pageWidth - 35) / 2, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("THE SOLUTION", solutionX + 5, 88);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const solutions = [
      "✓ Zero-latency real-time AI",
      "✓ Books directly into calendar",
      "✓ Remembers returning customers",
      "✓ Works 24/7/365"
    ];
    yPos = 102;
    solutions.forEach(solution => {
      doc.text(solution, solutionX + 5, yPos);
      yPos += 8;
    });
    
    // Features Box - black filled
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 145, pageWidth - 30, 35, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("WHAT YOU GET", pageWidth / 2, 157, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const features = [
      "AI Voice Receptionist  •  Online Booking Page  •  Customer Database",
      "SMS Notifications  •  Dashboard & Analytics  •  Deposit Collection"
    ];
    doc.text(features[0], pageWidth / 2, 168, { align: "center" });
    doc.text(features[1], pageWidth / 2, 176, { align: "center" });
    
    // Pricing section with border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(15, 190, pageWidth - 30, 40, "S");
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("LESS THAN £3 PER DAY", pageWidth / 2, 210, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Pays for itself with just 2-3 bookings per month", pageWidth / 2, 222, { align: "center" });
    
    // How it works section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("HOW IT WORKS", 20, 245);
    
    doc.setLineWidth(2);
    doc.line(20, 248, 80, 248);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const steps = [
      "1. Customer calls your number",
      "2. AI answers instantly (zero latency)",
      "3. Books appointment in real-time",
      "4. Sends SMS confirmation",
      "5. Updates your dashboard"
    ];
    yPos = 256;
    steps.forEach(step => {
      doc.text(step, 20, yPos);
      yPos += 6;
    });
    
    // Footer - black bar
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 285, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk  |  Book a demo today", pageWidth / 2, 295, { align: "center" });
    
    doc.save("AIVIA-Sales-Pitch.pdf");
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
              <CardTitle className="text-lg font-bold">Sales Pitch One-Pager</CardTitle>
              <CardDescription>Quick leave-behind document for prospects</CardDescription>
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
              <CheckCircle2 className="h-4 w-4" />
              Never Miss Another Booking
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Pain points & solutions</p>
              <p>• Key features overview</p>
              <p>• Pricing teaser</p>
              <p>• Contact information</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">Sales Pitch One-Pager Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border-2 border-foreground">
            {/* Header */}
            <div className="bg-foreground text-background p-6 text-center">
              <h1 className="text-3xl font-bold tracking-tight">AIVIA</h1>
              <p className="text-sm opacity-90">AI Voice Assistant for Businesses</p>
            </div>
            
            {/* Main Headline */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">NEVER MISS ANOTHER BOOKING</h2>
              <p className="text-muted-foreground">Your AI receptionist answers calls 24/7, books appointments, and remembers customers</p>
            </div>
            
            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pain Points */}
              <div className="border-2 border-foreground p-4 space-y-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <X className="h-5 w-5" />
                  THE PROBLEM
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span>✗</span>
                    Missing calls = Missing money
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✗</span>
                    80% of customers won't leave voicemail
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✗</span>
                    Receptionist costs £20,000+/year
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✗</span>
                    Too busy with clients to answer
                  </li>
                </ul>
              </div>
              
              {/* Solutions */}
              <div className="border-2 border-foreground p-4 space-y-3">
                <div className="bg-foreground text-background -mx-4 -mt-4 px-4 py-2 mb-3">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    THE SOLUTION
                  </h3>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span>✓</span>
                    Zero-latency real-time AI responses
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✓</span>
                    Books directly into your calendar
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✓</span>
                    Remembers returning customers
                  </li>
                  <li className="flex items-start gap-2">
                    <span>✓</span>
                    Works 24/7/365
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Features */}
            <div className="bg-foreground text-background p-4">
              <h3 className="font-bold text-center mb-3">WHAT YOU GET</h3>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-1"><Phone className="h-4 w-4" /> AI Voice</div>
                <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Online Booking</div>
                <div className="flex items-center gap-1"><Users className="h-4 w-4" /> Customer DB</div>
                <div className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> SMS</div>
                <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> Analytics</div>
              </div>
            </div>
            
            {/* Pricing */}
            <div className="border-2 border-foreground p-6 text-center">
              <p className="text-2xl font-bold">LESS THAN £3 PER DAY</p>
              <p className="text-muted-foreground text-sm">Pays for itself with just 2-3 bookings per month</p>
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