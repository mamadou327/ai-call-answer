import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Phone, Mic, Calendar, MessageSquare, BarChart3, ArrowRight } from "lucide-react";
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

export const generateHowItWorksPdf = async () => {
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
  doc.text("HOW AIVIA WORKS", pageWidth / 2, 12, { align: "center" });

  // Intro
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "A complete AI-powered phone receptionist that integrates with your business",
    pageWidth / 2,
    28,
    { align: "center" }
  );

  let yPos = 42;

  // Call Flow Section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("THE CALL FLOW", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 55, yPos + 2);

  // Step boxes - clean white with thin borders
  const steps = [
    { num: "1", title: "CUSTOMER CALLS", desc: "Customer dials your number" },
    { num: "2", title: "AI ANSWERS", desc: "Greets them instantly" },
    { num: "3", title: "UNDERSTANDS", desc: "Processes intent" },
    { num: "4", title: "BOOKS SLOT", desc: "Checks & books" },
    { num: "5", title: "CONFIRMS", desc: "Sends SMS" },
  ];

  let xPos = 15;
  const stepBoxWidth = 35;
  const stepBoxHeight = 32;
  const stepY = yPos + 8;

  steps.forEach((step) => {
    // White box with thin border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(xPos, stepY, stepBoxWidth, stepBoxHeight, "FD");

    // Number badge
    doc.setFillColor(0, 0, 0);
    doc.circle(xPos + stepBoxWidth / 2, stepY + 6, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(step.num, xPos + stepBoxWidth / 2, stepY + 7.5, { align: "center" });

    // Title and desc
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(step.title, xPos + stepBoxWidth / 2, stepY + 15, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(step.desc, stepBoxWidth - 4);
    doc.text(lines, xPos + stepBoxWidth / 2, stepY + 21, { align: "center" });

    xPos += stepBoxWidth + 3;
  });

  // Technology Section
  yPos = stepY + stepBoxHeight + 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("TECHNOLOGY STACK", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 65, yPos + 2);

  // Tech stack in white bordered box
  const techBoxY = yPos + 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, techBoxY, pageWidth - 30, 42, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const techStack = [
    ["Phone System:", "Twilio Media Streams - Real-time audio bridge"],
    ["Voice AI:", "OpenAI Realtime API - Zero-latency conversations"],
    ["Voice Output:", "OpenAI Native Voices - Natural, instant speech"],
    ["Database:", "Secure cloud storage for customer data and bookings"],
    ["Notifications:", "Automated SMS and email confirmations"],
  ];

  let techY = techBoxY + 10;
  techStack.forEach(([label, desc]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, techY);
    doc.setFont("helvetica", "normal");
    doc.text(desc, 52, techY);
    techY += 7;
  });

  // Dashboard Features
  yPos = techBoxY + 52;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("YOUR DASHBOARD", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 58, yPos + 2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const dashboardFeatures = [
    "  - Live call transcripts - See exactly what was said",
    "  - Booking calendar - All appointments in one view",
    "  - Customer database - Full history and preferences",
    "  - Analytics - Call volume, booking rates, peak times",
    "  - Message inbox - Voicemails and customer inquiries",
    "  - Staff management - Assign services to team members",
  ];

  yPos += 10;
  dashboardFeatures.forEach((feature) => {
    doc.text(feature, 20, yPos);
    yPos += 7;
  });

  // Integration Box - white with border, black title badge
  yPos += 8;
  const integrationY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, integrationY, pageWidth - 30, 22, "S");

  // Small black title badge
  doc.setFillColor(0, 0, 0);
  doc.rect(20, integrationY + 3, 65, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SEAMLESS INTEGRATION", 23, integrationY + 7.5);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Port your existing number or get a new one - we handle everything", 20, integrationY + 17);

  // Clean footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("www.aiviaapp.co.uk  |  Mo@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });

  doc.save("AIVIA-How-It-Works.pdf");
};

export const HowItWorksDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = () => {
    void generateHowItWorksPdf();
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
              <CardTitle className="text-lg font-bold">How AIVIA Works</CardTitle>
              <CardDescription>Technical overview for detailed explanations</CardDescription>
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
              <Phone className="h-4 w-4" />
              Complete Technical Breakdown
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Call flow diagram</p>
              <p>• Technology stack explained</p>
              <p>• Dashboard features</p>
              <p>• Integration options</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">How AIVIA Works - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border border-foreground/20">
            {/* Header */}
            <div className="border-b border-foreground pb-3">
              <h1 className="text-xl font-bold tracking-tight">HOW AIVIA WORKS</h1>
              <p className="text-sm text-muted-foreground mt-1">Complete AI-powered phone receptionist system</p>
            </div>
            
            {/* Call Flow */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold border-b border-foreground/30 pb-2">THE CALL FLOW</h2>
              <div className="flex flex-wrap gap-2 justify-between">
                {[
                  { icon: Phone, label: "1. CUSTOMER CALLS", desc: "Dials your number" },
                  { icon: Mic, label: "2. AI ANSWERS", desc: "Zero-latency response" },
                  { icon: Calendar, label: "3. BOOKS SLOT", desc: "Real-time booking" },
                  { icon: MessageSquare, label: "4. CONFIRMS", desc: "Sends SMS" },
                  { icon: BarChart3, label: "5. LOGS CALL", desc: "Updates dashboard" },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center p-3 bg-background border border-foreground/30 w-[18%] min-w-[100px]">
                    <step.icon className="h-6 w-6 mb-2" />
                    <span className="text-xs font-bold">{step.label}</span>
                    <span className="text-xs text-muted-foreground">{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Technology Stack */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b border-foreground/30 pb-2">TECHNOLOGY STACK</h2>
              <div className="border border-foreground/30 divide-y divide-foreground/20">
                {[
                  { label: "Phone System", value: "Twilio Media Streams - Real-time audio bridge" },
                  { label: "Voice AI", value: "OpenAI Realtime API - Zero-latency conversations" },
                  { label: "Voice Output", value: "OpenAI Native Voices - Instant natural speech" },
                  { label: "Database", value: "Secure cloud storage" },
                  { label: "Notifications", value: "Automated SMS & email" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <span className="font-bold text-sm min-w-[120px]">{item.label}:</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Dashboard Features */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b border-foreground/30 pb-2">DASHBOARD FEATURES</h2>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "Live call transcripts",
                  "Booking calendar view",
                  "Customer database",
                  "Analytics & insights",
                  "Message inbox",
                  "Staff management",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border border-foreground/30 p-2">
                    <ArrowRight className="h-4 w-4" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Integration */}
            <div className="border border-foreground/30 p-4">
              <div className="inline-block bg-foreground text-background px-2 py-1 text-xs font-bold mb-2">
                SEAMLESS INTEGRATION
              </div>
              <p className="text-sm text-muted-foreground">
                Port your existing number or get a new one - we handle everything
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