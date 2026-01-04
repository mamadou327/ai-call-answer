import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Mic, MessageCircle, AlertCircle, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

export const DemoScriptDocument = () => {
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
    doc.text("Demo Script Guide", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Use this script for your sales conversations", pageWidth / 2, 48, { align: "center" });
    
    // Opening Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("15-Second Opener", 20, 65);
    
    doc.setFillColor(245, 245, 255);
    doc.rect(15, 70, pageWidth - 30, 25, "F");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(60, 60, 60);
    const opener = '"What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."';
    const openerLines = doc.splitTextToSize(opener, pageWidth - 40);
    doc.text(openerLines, 20, 80);
    
    // Pain-Focused Questions
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Pain-Focused Questions", 20, 110);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const questions = [
      "• \"How many calls do you miss while you're with clients?\"",
      "• \"What happens when someone calls after hours?\"",
      "• \"How much is a typical booking worth to you?\"",
      "• \"Have you ever calculated how much missed calls cost you?\"",
    ];
    
    let yPos = 120;
    questions.forEach(q => {
      doc.text(q, 20, yPos);
      yPos += 8;
    });
    
    // Wait Really Moments
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("\"Wait, Really?\" Moments", 20, 160);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const moments = [
      "• \"It recognizes returning customers by their phone number and greets them by name\"",
      "• \"It can book a family of 4 with different services in one call\"",
      "• \"Every call is transcribed - you can see exactly what was said\"",
      "• \"It works 24/7 including bank holidays - no sick days, no training\"",
    ];
    
    yPos = 170;
    moments.forEach(m => {
      doc.text(m, 20, yPos);
      yPos += 8;
    });
    
    // Objection Handlers
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Common Objections & Responses", 20, 210);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const objections = [
      ["\"It's too expensive\"", "→ \"It's less than £3/day - one recovered booking pays for the month\""],
      ["\"My customers prefer humans\"", "→ \"80% prefer immediate AI over waiting for a human callback\""],
      ["\"What if it makes mistakes?\"", "→ \"You see every transcript - and it learns your business rules\""],
      ["\"I'm too busy to set it up\"", "→ \"We handle everything - you just approve your settings\""],
    ];
    
    yPos = 220;
    objections.forEach(([obj, resp]) => {
      doc.setFont("helvetica", "bold");
      doc.text(obj, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(resp, 20, yPos + 6);
      yPos += 15;
    });
    
    // Closing
    doc.setFillColor(245, 245, 255);
    doc.rect(15, 270, pageWidth - 30, 15, "F");
    doc.setDrawColor(139, 92, 246);
    doc.rect(15, 270, pageWidth - 30, 15, "S");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Closing: \"Ready to stop losing bookings? Let me show you how it sounds...\"", 20, 280);
    
    // Footer
    doc.setFillColor(30, 30, 30);
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
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Demo Script Guide</CardTitle>
              <CardDescription>Talking points for your meeting</CardDescription>
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
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mic className="h-4 w-4 text-orange-500" />
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
            <DialogTitle>Demo Script Guide - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border rounded-lg">
            {/* Header */}
            <div className="bg-primary text-primary-foreground rounded-lg p-6 text-center">
              <h1 className="text-2xl font-bold">Demo Script Guide</h1>
              <p className="text-sm opacity-90 mt-1">Your sales conversation playbook</p>
            </div>
            
            {/* Opening */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                15-Second Opener
              </h2>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 italic text-sm">
                "What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."
              </div>
            </div>
            
            {/* Pain Questions */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Pain-Focused Questions
              </h2>
              <ul className="space-y-2 text-sm">
                <li>"How many calls do you miss while you're with clients?"</li>
                <li>"What happens when someone calls after hours?"</li>
                <li>"How much is a typical booking worth to you?"</li>
                <li>"Have you calculated how much missed calls cost you?"</li>
              </ul>
            </div>
            
            {/* Wait Really Moments */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                "Wait, Really?" Moments
              </h2>
              <ul className="space-y-2 text-sm bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <li>• Recognizes returning customers by phone number</li>
                <li>• Books a family of 4 in one call</li>
                <li>• Every call is transcribed</li>
                <li>• Works 24/7 - no sick days, no training</li>
              </ul>
            </div>
            
            {/* Objections */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Objection Handlers
              </h2>
              <div className="space-y-3">
                {[
                  { obj: "\"It's too expensive\"", resp: "Less than £3/day - one booking pays for the month" },
                  { obj: "\"Customers prefer humans\"", resp: "80% prefer immediate AI over waiting for callback" },
                  { obj: "\"What if it makes mistakes?\"", resp: "You see every transcript - it learns your rules" },
                  { obj: "\"I'm too busy to set it up\"", resp: "We handle everything - you just approve" },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium text-sm">{item.obj}</p>
                    <p className="text-sm text-muted-foreground mt-1">→ {item.resp}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Closing */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
              <p className="font-semibold text-primary">
                "Ready to stop losing bookings? Let me show you how it sounds..."
              </p>
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
