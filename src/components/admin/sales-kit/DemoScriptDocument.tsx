import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Mic, MessageCircle, AlertCircle, Lightbulb } from "lucide-react";
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

export const DemoScriptDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Slim header strip
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 18, "F");
    
    // Add logo
    try {
      const logoData = await loadImageAsBase64(aiviaLogo);
      doc.addImage(logoData, "PNG", 8, 2, 14, 14);
    } catch (e) {
      console.error("Failed to load logo:", e);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DEMO SCRIPT GUIDE", pageWidth / 2 + 5, 12, { align: "center" });
    
    // Subtitle
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Use this script for your sales conversations", pageWidth / 2, 28, { align: "center" });
    
    // Opening Section
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("15-SECOND OPENER", 20, 42);
    doc.setLineWidth(0.5);
    doc.line(20, 44, 60, 44);
    
    // Opener box - light gray background
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(15, 48, pageWidth - 30, 22, "FD");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(40, 40, 40);
    const opener = '"What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."';
    const openerLines = doc.splitTextToSize(opener, pageWidth - 40);
    doc.text(openerLines, 20, 56);
    
    // Pain-Focused Questions
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("PAIN-FOCUSED QUESTIONS", 20, 82);
    doc.setLineWidth(0.5);
    doc.line(20, 84, 75, 84);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    
    const questions = [
      '"How many calls do you miss while you\'re with clients?"',
      '"What happens when someone calls after hours?"',
      '"How much is a typical booking worth to you?"',
      '"Have you ever calculated how much missed calls cost you?"',
    ];
    
    let yPos = 94;
    questions.forEach((q, i) => {
      doc.text(`${i + 1}.  ${q}`, 20, yPos);
      yPos += 8;
    });
    
    // Wait Really Moments - white box with title badge
    const momentsY = 128;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(15, momentsY, pageWidth - 30, 38, "S");
    
    // Black title badge
    doc.setFillColor(0, 0, 0);
    doc.rect(20, momentsY + 4, 60, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text('"WAIT, REALLY?" MOMENTS', 23, momentsY + 9);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    
    const moments = [
      "•  It recognizes returning customers and greets them by name",
      "•  It can book a family of 4 with different services in one call",
      "•  Every call is transcribed - see exactly what was said",
      "•  Works 24/7 including bank holidays - no sick days",
    ];
    
    yPos = momentsY + 20;
    moments.forEach(m => {
      doc.text(m, 20, yPos);
      yPos += 7;
    });
    
    // Objection Handlers
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("OBJECTION HANDLERS", 20, 180);
    doc.setLineWidth(0.5);
    doc.line(20, 182, 68, 182);
    
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    
    const objections = [
      ['"It\'s too expensive"', 'Less than £3/day - one booking pays for the month'],
      ['"Customers prefer humans"', '80% prefer immediate AI over waiting for callback'],
      ['"What if it makes mistakes?"', 'You see every transcript - and it learns your rules'],
      ['"I\'m too busy to set it up"', 'We handle everything - you just approve'],
    ];
    
    yPos = 192;
    objections.forEach(([obj, resp]) => {
      doc.setFont("helvetica", "bold");
      doc.text(obj, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text("  ->  " + resp, 20 + doc.getTextWidth(obj) + 2, yPos);
      yPos += 10;
    });
    
    // Closing - simple bordered box
    const closeY = 238;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(15, closeY, pageWidth - 30, 14, "S");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text('CLOSE: "Ready to stop losing bookings? Let me show you how it sounds..."', 20, closeY + 9);
    
    // Clean footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });
    
    doc.save("AIVIA-Demo-Script.pdf");
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
              <CardTitle className="text-lg font-bold">Demo Script Guide</CardTitle>
              <CardDescription>Talking points for your meeting</CardDescription>
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
              <Mic className="h-4 w-4" />
              Sales Conversation Guide
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 15-second opener</p>
              <p>• Pain-focused questions</p>
              <p>• "Wait, really?" moments</p>
              <p>• Objection handlers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">Demo Script Guide - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border border-foreground/20">
            {/* Header */}
            <div className="border-b border-foreground pb-3">
              <h1 className="text-xl font-bold tracking-tight">DEMO SCRIPT GUIDE</h1>
              <p className="text-sm text-muted-foreground mt-1">Your sales conversation playbook</p>
            </div>
            
            {/* Opening */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-foreground/30 pb-2">
                <Mic className="h-5 w-5" />
                15-SECOND OPENER
              </h2>
              <div className="bg-muted/50 border border-foreground/20 p-4 italic text-sm">
                "What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."
              </div>
            </div>
            
            {/* Pain Questions */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-foreground/30 pb-2">
                <MessageCircle className="h-5 w-5" />
                PAIN-FOCUSED QUESTIONS
              </h2>
              <ul className="space-y-2 text-sm">
                <li>1. "How many calls do you miss while you're with clients?"</li>
                <li>2. "What happens when someone calls after hours?"</li>
                <li>3. "How much is a typical booking worth to you?"</li>
                <li>4. "Have you calculated how much missed calls cost you?"</li>
              </ul>
            </div>
            
            {/* Wait Really Moments */}
            <div className="border border-foreground/30">
              <div className="inline-block bg-foreground text-background px-2 py-1 text-xs font-bold m-3 mb-0">
                "WAIT, REALLY?" MOMENTS
              </div>
              <ul className="space-y-2 text-sm p-4 pt-2">
                <li>• Recognizes returning customers by phone number</li>
                <li>• Books a family of 4 in one call</li>
                <li>• Every call is transcribed</li>
                <li>• Works 24/7 - no sick days, no training</li>
              </ul>
            </div>
            
            {/* Objections */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-foreground/30 pb-2">
                <AlertCircle className="h-5 w-5" />
                OBJECTION HANDLERS
              </h2>
              <div className="space-y-3">
                {[
                  { obj: '"It\'s too expensive"', resp: "Less than £3/day - one booking pays for the month" },
                  { obj: '"Customers prefer humans"', resp: "80% prefer immediate AI over waiting for callback" },
                  { obj: '"What if it makes mistakes?"', resp: "You see every transcript - it learns your rules" },
                  { obj: '"I\'m too busy to set it up"', resp: "We handle everything - you just approve" },
                ].map((item, i) => (
                  <div key={i} className="p-3 border border-foreground/30">
                    <p className="font-bold text-sm">{item.obj}</p>
                    <p className="text-sm text-muted-foreground mt-1">→ {item.resp}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Closing */}
            <div className="border border-foreground/30 p-4 text-center">
              <p className="font-bold">
                "Ready to stop losing bookings? Let me show you how it sounds..."
              </p>
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