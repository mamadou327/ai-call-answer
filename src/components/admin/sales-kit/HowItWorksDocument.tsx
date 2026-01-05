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

export const HowItWorksDocument = () => {
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
    doc.text("HOW AIVIA WORKS", pageWidth / 2 + 10, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("AIVIA is a complete AI-powered phone receptionist that integrates with your business.", 20, 50);
    
    // Call Flow Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("THE CALL FLOW", 20, 65);
    doc.setLineWidth(2);
    doc.line(20, 68, 70, 68);
    
    // Step boxes - black bordered neobrutalist style
    const steps = [
      { num: "1", title: "CUSTOMER CALLS", desc: "Customer dials your AIVIA number" },
      { num: "2", title: "AI ANSWERS", desc: "AI greets them instantly (zero latency)" },
      { num: "3", title: "UNDERSTANDS", desc: "AI processes intent in real-time" },
      { num: "4", title: "BOOKS SLOT", desc: "Checks availability, books appointment" },
      { num: "5", title: "CONFIRMS", desc: "Customer gets instant SMS confirmation" },
    ];
    
    let xPos = 15;
    doc.setFontSize(9);
    steps.forEach((step, i) => {
      // Box with thick black border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(2);
      doc.setFillColor(255, 255, 255);
      doc.rect(xPos, 75, 35, 38, "FD");
      
      // Number in black circle
      doc.setFillColor(0, 0, 0);
      doc.circle(xPos + 17.5, 82, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(step.num, xPos + 17.5, 84, { align: "center" });
      
      // Title and desc
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(step.title, xPos + 17.5, 93, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(step.desc, 30);
      doc.text(lines, xPos + 17.5, 99, { align: "center" });
      
      xPos += 38;
    });
    
    // Technology Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("TECHNOLOGY STACK", 20, 130);
    doc.setLineWidth(2);
    doc.line(20, 133, 85, 133);
    
    // Tech stack in black bordered box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(15, 138, pageWidth - 30, 45, "S");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const techStack = [
      ["Phone System:", "Twilio Media Streams - Real-time audio bridge"],
      ["Voice AI:", "OpenAI Realtime API - True zero-latency conversations"],
      ["Voice Output:", "OpenAI Native Voices - Natural, instant speech"],
      ["Database:", "Secure cloud storage for customer data and bookings"],
      ["Notifications:", "Automated SMS and email confirmations"],
    ];
    
    let yPos = 148;
    techStack.forEach(([label, desc]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(desc, 58, yPos);
      yPos += 8;
    });
    
    // What Business Owners See
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("YOUR DASHBOARD", 20, 200);
    doc.setLineWidth(2);
    doc.line(20, 203, 75, 203);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
    const dashboardFeatures = [
      "• Live call transcripts - See exactly what was said",
      "• Booking calendar - All appointments in one view",
      "• Customer database - Full history and preferences",
      "• Analytics - Call volume, booking rates, peak times",
      "• Message inbox - Voicemails and customer inquiries",
      "• Staff management - Assign services to team members",
    ];
    
    yPos = 213;
    dashboardFeatures.forEach(feature => {
      doc.text(feature, 20, yPos);
      yPos += 7;
    });
    
    // Integration Box - black filled
    doc.setFillColor(0, 0, 0);
    doc.rect(15, 260, pageWidth - 30, 20, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SEAMLESS INTEGRATION", pageWidth / 2, 270, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Port your existing number or get a new one - we handle everything", pageWidth / 2, 278, { align: "center" });
    
    // Footer
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 285, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 295, { align: "center" });
    
    doc.save("AIVIA-How-It-Works.pdf");
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
          <div className="space-y-6 p-4 bg-background border-2 border-foreground">
            {/* Header */}
            <div className="bg-foreground text-background p-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">HOW AIVIA WORKS</h1>
              <p className="text-sm opacity-90 mt-1">Complete AI-powered phone receptionist system</p>
            </div>
            
            {/* Call Flow */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold border-b-2 border-foreground pb-2">THE CALL FLOW</h2>
              <div className="flex flex-wrap gap-2 justify-between">
                {[
                  { icon: Phone, label: "1. CUSTOMER CALLS", desc: "Dials your number" },
                  { icon: Mic, label: "2. AI ANSWERS", desc: "Zero-latency response" },
                  { icon: Calendar, label: "3. BOOKS SLOT", desc: "Real-time booking" },
                  { icon: MessageSquare, label: "4. CONFIRMS", desc: "Sends SMS" },
                  { icon: BarChart3, label: "5. LOGS CALL", desc: "Updates dashboard" },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center p-3 bg-background border-2 border-foreground w-[18%] min-w-[100px]">
                    <step.icon className="h-6 w-6 mb-2" />
                    <span className="text-xs font-bold">{step.label}</span>
                    <span className="text-xs text-muted-foreground">{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Technology Stack */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b-2 border-foreground pb-2">TECHNOLOGY STACK</h2>
              <div className="border-2 border-foreground divide-y-2 divide-foreground">
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
              <h2 className="text-lg font-bold border-b-2 border-foreground pb-2">DASHBOARD FEATURES</h2>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "Live call transcripts",
                  "Booking calendar view",
                  "Customer database",
                  "Analytics & insights",
                  "Message inbox",
                  "Staff management",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-2 border-foreground p-2">
                    <ArrowRight className="h-4 w-4" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Integration */}
            <div className="bg-foreground text-background p-4 text-center">
              <h3 className="font-bold mb-2">SEAMLESS INTEGRATION</h3>
              <p className="text-sm opacity-90">
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