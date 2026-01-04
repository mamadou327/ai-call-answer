import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Phone, Mic, Calendar, MessageSquare, CreditCard, BarChart3, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

export const HowItWorksDocument = () => {
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
    doc.text("How AIVIA Works", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("AIVIA is a complete AI-powered phone receptionist that integrates with your business.", 20, 50);
    
    // Call Flow Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("The Call Flow", 20, 65);
    
    // Step boxes
    const steps = [
      { num: "1", title: "Customer Calls", desc: "Customer dials your AIVIA number" },
      { num: "2", title: "AI Answers", desc: "AI greets them by name if returning" },
      { num: "3", title: "Understands Intent", desc: "AI understands what they need" },
      { num: "4", title: "Books Appointment", desc: "Checks availability, books slot" },
      { num: "5", title: "Confirms via SMS", desc: "Customer gets instant confirmation" },
    ];
    
    let xPos = 15;
    doc.setFontSize(9);
    steps.forEach((step, i) => {
      // Box
      doc.setFillColor(245, 245, 255);
      doc.rect(xPos, 72, 35, 35, "F");
      doc.setDrawColor(139, 92, 246);
      doc.rect(xPos, 72, 35, 35, "S");
      
      // Number circle
      doc.setFillColor(139, 92, 246);
      doc.circle(xPos + 17.5, 77, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(step.num, xPos + 17.5, 79, { align: "center" });
      
      // Title and desc
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(step.title, xPos + 17.5, 88, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(step.desc, 30);
      doc.text(lines, xPos + 17.5, 94, { align: "center" });
      
      xPos += 38;
    });
    
    // Technology Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("The Technology Stack", 20, 125);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const techStack = [
      ["Phone System:", "Twilio Media Streams - Real-time audio bridge"],
      ["Voice AI:", "OpenAI Realtime API - True zero-latency conversations"],
      ["Voice Output:", "OpenAI Native Voices - Natural, instant speech"],
      ["Database:", "Secure cloud storage for customer data and bookings"],
      ["Notifications:", "Automated SMS and email confirmations"],
    ];
    
    let yPos = 135;
    techStack.forEach(([label, desc]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(desc, 55, yPos);
      yPos += 8;
    });
    
    // What Business Owners See
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("What You See in Your Dashboard", 20, 185);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const dashboardFeatures = [
      "• Live call transcripts - See exactly what was said",
      "• Booking calendar - All appointments in one view",
      "• Customer database - Full history and preferences",
      "• Analytics - Call volume, booking rates, peak times",
      "• Message inbox - Voicemails and customer inquiries",
      "• Staff management - Assign services to team members",
    ];
    
    yPos = 195;
    dashboardFeatures.forEach(feature => {
      doc.text(feature, 20, yPos);
      yPos += 7;
    });
    
    // Integration Box
    doc.setFillColor(245, 245, 255);
    doc.rect(15, 245, pageWidth - 30, 25, "F");
    doc.setDrawColor(139, 92, 246);
    doc.rect(15, 245, pageWidth - 30, 25, "S");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Seamless Integration", pageWidth / 2, 255, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Works with your existing phone number (port your number) or we provide a new one", pageWidth / 2, 264, { align: "center" });
    
    // Footer
    doc.setFillColor(30, 30, 30);
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
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">How AIVIA Works</CardTitle>
              <CardDescription>Technical overview for detailed explanations</CardDescription>
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
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4 text-blue-500" />
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
            <DialogTitle>How AIVIA Works - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border rounded-lg">
            {/* Header */}
            <div className="bg-primary text-primary-foreground rounded-lg p-6 text-center">
              <h1 className="text-2xl font-bold">How AIVIA Works</h1>
              <p className="text-sm opacity-90 mt-1">Complete AI-powered phone receptionist system</p>
            </div>
            
            {/* Call Flow */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold">The Call Flow</h2>
              <div className="flex flex-wrap gap-2 justify-between">
                {[
                  { icon: Phone, label: "1. Customer Calls", desc: "Dials your number" },
                  { icon: Mic, label: "2. AI Answers", desc: "Greets by name" },
                  { icon: Calendar, label: "3. Books Slot", desc: "Checks availability" },
                  { icon: MessageSquare, label: "4. Confirms", desc: "Sends SMS" },
                  { icon: BarChart3, label: "5. Logs Call", desc: "Updates dashboard" },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center p-3 bg-primary/5 rounded-lg border border-primary/20 w-[18%] min-w-[100px]">
                    <step.icon className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-semibold">{step.label}</span>
                    <span className="text-xs text-muted-foreground">{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Technology Stack */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Technology Stack</h2>
              <div className="grid gap-2">
              {[
                  { label: "Phone System", value: "Twilio Media Streams - Real-time audio bridge" },
                  { label: "Voice AI", value: "OpenAI Realtime API - Zero-latency conversations" },
                  { label: "Voice Output", value: "OpenAI Native Voices - Instant natural speech" },
                  { label: "Database", value: "Secure cloud storage" },
                  { label: "Notifications", value: "Automated SMS & email" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                    <span className="font-semibold text-sm min-w-[120px]">{item.label}:</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Dashboard Features */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Dashboard Features</h2>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "Live call transcripts",
                  "Booking calendar view",
                  "Customer database",
                  "Analytics & insights",
                  "Message inbox",
                  "Staff management",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Integration */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <h3 className="font-semibold mb-2">Seamless Integration</h3>
              <p className="text-sm text-muted-foreground">
                Works with your existing phone number (port your number) or we provide a new one
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
