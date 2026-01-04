import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, X, CheckCircle2, Phone, Clock, Users, Calendar, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

export const SalesPitchDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with brand color
    doc.setFillColor(139, 92, 246); // Purple
    doc.rect(0, 0, pageWidth, 40, "F");
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("AIVIA", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("AI Voice Assistant for Businesses", pageWidth / 2, 30, { align: "center" });
    
    // Main headline
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Never Miss Another Booking", pageWidth / 2, 60, { align: "center" });
    
    // Subheadline
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Your AI receptionist answers calls 24/7, books appointments, and remembers customers", pageWidth / 2, 70, { align: "center" });
    
    // Pain Points Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("The Problem", 20, 90);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const painPoints = [
      "• Missing calls = Missing money (average booking worth £30-50)",
      "• Customers hate voicemail - 80% won't leave a message",
      "• Hiring a receptionist costs £20,000+ per year",
      "• You're busy with clients and can't answer every call"
    ];
    let yPos = 100;
    painPoints.forEach(point => {
      doc.text(point, 20, yPos);
      yPos += 8;
    });
    
    // Solution Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("The AIVIA Solution", 20, 145);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const solutions = [
      "✓ Answers every call instantly - no hold music, no waiting",
      "✓ Books appointments directly into your calendar",
      "✓ Remembers returning customers and their preferences",
      "✓ Handles group bookings (families, couples, etc.)",
      "✓ Sends SMS confirmations automatically",
      "✓ Works 24/7/365 - nights, weekends, bank holidays"
    ];
    yPos = 155;
    solutions.forEach(solution => {
      doc.text(solution, 20, yPos);
      yPos += 8;
    });
    
    // Features Box
    doc.setFillColor(245, 245, 255);
    doc.rect(15, 200, pageWidth - 30, 45, "F");
    doc.setDrawColor(139, 92, 246);
    doc.rect(15, 200, pageWidth - 30, 45, "S");
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("What You Get", 20, 212);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const features = [
      "AI Voice Receptionist  •  Online Booking Page  •  Customer Database",
      "SMS Notifications  •  Dashboard & Analytics  •  Deposit Collection"
    ];
    doc.text(features[0], pageWidth / 2, 225, { align: "center" });
    doc.text(features[1], pageWidth / 2, 235, { align: "center" });
    
    // Pricing Teaser
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Less than £3 per day", pageWidth / 2, 265, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Pay for itself with just 2-3 bookings per month", pageWidth / 2, 275, { align: "center" });
    
    // Footer
    doc.setFillColor(30, 30, 30);
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
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Sales Pitch One-Pager</CardTitle>
              <CardDescription>Quick leave-behind document for prospects</CardDescription>
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
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
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
            <DialogTitle>Sales Pitch One-Pager Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border rounded-lg">
            {/* Header */}
            <div className="bg-primary text-primary-foreground rounded-lg p-6 text-center">
              <h1 className="text-3xl font-bold">AIVIA</h1>
              <p className="text-sm opacity-90">AI Voice Assistant for Businesses</p>
            </div>
            
            {/* Main Headline */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Never Miss Another Booking</h2>
              <p className="text-muted-foreground">Your AI receptionist answers calls 24/7, books appointments, and remembers customers</p>
            </div>
            
            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pain Points */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  The Problem
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    Missing calls = Missing money
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    80% of customers won't leave voicemail
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    Receptionist costs £20,000+/year
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    Too busy with clients to answer
                  </li>
                </ul>
              </div>
              
              {/* Solutions */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  The Solution
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Answers every call instantly
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Books directly into your calendar
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Remembers returning customers
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    Works 24/7/365
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Features */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h3 className="font-semibold text-center mb-3">What You Get</h3>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-1"><Phone className="h-4 w-4" /> AI Voice</div>
                <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Online Booking</div>
                <div className="flex items-center gap-1"><Users className="h-4 w-4" /> Customer DB</div>
                <div className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> SMS</div>
                <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> Analytics</div>
              </div>
            </div>
            
            {/* Pricing */}
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">Less than £3 per day</p>
              <p className="text-muted-foreground text-sm">Pays for itself with just 2-3 bookings per month</p>
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
