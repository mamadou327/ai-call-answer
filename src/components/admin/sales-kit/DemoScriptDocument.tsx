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
    
    // Header - Black neobrutalist style
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 35, "F");
    
    // Add logo
    try {
      const logoData = await loadImageAsBase64(aiviaLogo);
      doc.addImage(logoData, "PNG", 10, 5, 25, 25);
    } catch (e) {
      console.error("Failed to load logo:", e);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("DEMO SCRIPT GUIDE", pageWidth / 2 + 10, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Use this script for your sales conversations", pageWidth / 2, 48, { align: "center" });
    
    // Opening Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("15-SECOND OPENER", 20, 65);
    doc.setLineWidth(2);
    doc.line(20, 68, 75, 68);
    
    // Opener box - black bordered
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 72, pageWidth - 30, 25, "FD");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(30, 30, 30);
    const opener = '"What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."';
    const openerLines = doc.splitTextToSize(opener, pageWidth - 40);
    doc.text(openerLines, 20, 82);
    
    // Pain-Focused Questions
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("PAIN-FOCUSED QUESTIONS", 20, 112);
    doc.setLineWidth(2);
    doc.line(20, 115, 95, 115);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const questions = [
      "• \"How many calls do you miss while you're with clients?\"",
      "• \"What happens when someone calls after hours?\"",
      "• \"How much is a typical booking worth to you?\"",
      "• \"Have you ever calculated how much missed calls cost you?\"",
    ];
    
    let yPos = 125;
    questions.forEach(q => {
      doc.text(q, 20, yPos);
      yPos += 8;
    });
    
    // Wait Really Moments - black box header
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 160, pageWidth - 30, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("\"WAIT, REALLY?\" MOMENTS", 20, 168);
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(15, 160, pageWidth - 30, 40, "S");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const moments = [
      "• It recognizes returning customers and greets them by name",
      "• It can book a family of 4 with different services in one call",
      "• Every call is transcribed - see exactly what was said",
      "• Works 24/7 including bank holidays - no sick days",
    ];
    
    yPos = 180;
    moments.forEach(m => {
      doc.text(m, 20, yPos);
      yPos += 7;
    });
    
    // Objection Handlers
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("OBJECTION HANDLERS", 20, 215);
    doc.setLineWidth(2);
    doc.line(20, 218, 85, 218);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const objections = [
      ["\"It's too expensive\"", "→ \"Less than £3/day - one booking pays for the month\""],
      ["\"Customers prefer humans\"", "→ \"80% prefer immediate AI over waiting for callback\""],
      ["\"What if it makes mistakes?\"", "→ \"You see every transcript - and it learns your rules\""],
      ["\"I'm too busy to set it up\"", "→ \"We handle everything - you just approve\""],
    ];
    
    yPos = 228;
    objections.forEach(([obj, resp]) => {
      doc.setFont("helvetica", "bold");
      doc.text(obj, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(resp, 20, yPos + 6);
      yPos += 15;
    });
    
    // Closing - black box
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 275, pageWidth - 30, 12, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("CLOSE: \"Ready to stop losing bookings? Let me show you how it sounds...\"", 20, 283);
    
    // Footer
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 290, pageWidth, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 298, { align: "center" });
    
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
          <div className="space-y-6 p-4 bg-background border-2 border-foreground">
            {/* Header */}
            <div className="bg-foreground text-background p-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">DEMO SCRIPT GUIDE</h1>
              <p className="text-sm opacity-90 mt-1">Your sales conversation playbook</p>
            </div>
            
            {/* Opening */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b-2 border-foreground pb-2">
                <Mic className="h-5 w-5" />
                15-SECOND OPENER
              </h2>
              <div className="bg-muted border-2 border-foreground p-4 italic text-sm">
                "What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."
              </div>
            </div>
            
            {/* Pain Questions */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b-2 border-foreground pb-2">
                <MessageCircle className="h-5 w-5" />
                PAIN-FOCUSED QUESTIONS
              </h2>
              <ul className="space-y-2 text-sm">
                <li>"How many calls do you miss while you're with clients?"</li>
                <li>"What happens when someone calls after hours?"</li>
                <li>"How much is a typical booking worth to you?"</li>
                <li>"Have you calculated how much missed calls cost you?"</li>
              </ul>
            </div>
            
            {/* Wait Really Moments */}
            <div className="border-2 border-foreground">
              <div className="bg-foreground text-background p-3">
                <h2 className="font-bold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  "WAIT, REALLY?" MOMENTS
                </h2>
              </div>
              <ul className="space-y-2 text-sm p-4">
                <li>• Recognizes returning customers by phone number</li>
                <li>• Books a family of 4 in one call</li>
                <li>• Every call is transcribed</li>
                <li>• Works 24/7 - no sick days, no training</li>
              </ul>
            </div>
            
            {/* Objections */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b-2 border-foreground pb-2">
                <AlertCircle className="h-5 w-5" />
                OBJECTION HANDLERS
              </h2>
              <div className="space-y-3">
                {[
                  { obj: "\"It's too expensive\"", resp: "Less than £3/day - one booking pays for the month" },
                  { obj: "\"Customers prefer humans\"", resp: "80% prefer immediate AI over waiting for callback" },
                  { obj: "\"What if it makes mistakes?\"", resp: "You see every transcript - it learns your rules" },
                  { obj: "\"I'm too busy to set it up\"", resp: "We handle everything - you just approve" },
                ].map((item, i) => (
                  <div key={i} className="p-3 border-2 border-foreground">
                    <p className="font-bold text-sm">{item.obj}</p>
                    <p className="text-sm text-muted-foreground mt-1">→ {item.resp}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Closing */}
            <div className="bg-foreground text-background p-4 text-center">
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