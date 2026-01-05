import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, PoundSterling, Server, Phone, Mail, CreditCard, Bot } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

export const generateExpendituresPdf = async () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  const headerHeight = 20;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(0, headerHeight, pageWidth, headerHeight);

  try {
    const logoData = await loadImageAsBase64(aiviaLogo);
    doc.addImage(logoData, "PNG", 8, 3, 14, 14);
  } catch (e) {
    // Continue without logo
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("AIVIA RUNNING COSTS", pageWidth / 2, 13, { align: "center" });

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Complete breakdown of costs to run AIVIA for your customers", pageWidth / 2, 30, { align: "center" });

  // Core Infrastructure Table
  let yPos = 40;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("CORE INFRASTRUCTURE", 15, yPos);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 65, yPos + 2);

  autoTable(doc, {
    startY: yPos + 6,
    head: [["Service", "Cost", "Notes"]],
    body: [
      ["Lovable Subscription", "~£20-80/month", "Includes cloud hosting"],
      ["Custom Domain", "~£10-15/year", "Optional - for booking pages"],
    ],
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  // Communication Services Table
  yPos = (doc as any).lastAutoTable?.finalY + 10 || 80;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PHONE SYSTEM (TWILIO)", 15, yPos);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 65, yPos + 2);

  autoTable(doc, {
    startY: yPos + 6,
    head: [["Service", "Cost", "Notes"]],
    body: [
      ["Phone Number", "~£1-3/month", "Per number (local or mobile)"],
      ["Voice Minutes", "~£0.015-0.02/min", "Inbound + Outbound calls"],
      ["SMS Messages", "~£0.04/SMS", "Booking confirmations"],
    ],
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  // AI Services Table
  yPos = (doc as any).lastAutoTable?.finalY + 10 || 130;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("AI SERVICES (OPENAI)", 15, yPos);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 60, yPos + 2);

  autoTable(doc, {
    startY: yPos + 6,
    head: [["Service", "Cost", "Notes"]],
    body: [
      ["Realtime Voice API", "~$0.002-0.06/1K tokens", "AI conversation processing"],
    ],
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  // Optional Services Table
  yPos = (doc as any).lastAutoTable?.finalY + 10 || 165;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("OPTIONAL SERVICES", 15, yPos);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 55, yPos + 2);

  autoTable(doc, {
    startY: yPos + 6,
    head: [["Service", "Cost", "Notes"]],
    body: [
      ["Resend (Email)", "Free / ~$20/month", "Free: 3,000 emails/month"],
      ["Stripe (Payments)", "1.5% + 20p/transaction", "Deposit collection"],
    ],
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  // Example Calculation Box
  yPos = (doc as any).lastAutoTable?.finalY + 12 || 210;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(15, yPos, pageWidth - 30, 58, "S");
  
  doc.setFillColor(0, 0, 0);
  doc.rect(20, yPos + 4, 90, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EXAMPLE: TYPICAL SALON (PER MONTH)", 23, yPos + 9);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const exampleCalc = [
    ["Lovable Subscription", "~£30"],
    ["Twilio Number (1)", "~£2"],
    ["Voice Minutes (200 min)", "~£4"],
    ["SMS (50 messages)", "~£2"],
    ["OpenAI (~500K tokens)", "~£3"],
    ["Resend (Free tier)", "£0"],
  ];
  
  let calcY = yPos + 20;
  exampleCalc.forEach(([item, cost]) => {
    doc.text(item, 25, calcY);
    doc.text(cost, pageWidth - 40, calcY, { align: "right" });
    calcY += 6;
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(25, calcY, pageWidth - 25, calcY);
  calcY += 6;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL RUNNING COST", 25, calcY);
  doc.text("~£41/month", pageWidth - 40, calcY, { align: "right" });

  // Profit Margin Box
  yPos = yPos + 68;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos, pageWidth - 30, 22, "S");
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PROFIT MARGIN", pageWidth / 2, yPos + 8, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Customer pays: £85/month  |  Your cost: ~£41/month  |  Profit: ~£44/month per customer", pageWidth / 2, yPos + 16, { align: "center" });

  // Footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("www.aiviaapp.co.uk  |  Mo@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });

  doc.save("AIVIA-Expenditures.pdf");
};

export const ExpendituresDocument = () => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatePDF = () => {
    void generateExpendituresPdf();
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
              <CardTitle className="text-lg font-bold">Running Costs & Expenditures</CardTitle>
              <CardDescription>Breakdown of costs to run AIVIA</CardDescription>
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
              <PoundSterling className="h-4 w-4" />
              Know Your Costs
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Core infrastructure costs</p>
              <p>• Phone & SMS pricing</p>
              <p>• AI service costs</p>
              <p>• Profit margin calculator</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">Running Costs & Expenditures Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border border-foreground/20">
            {/* Header */}
            <div className="border-b border-foreground pb-3">
              <h1 className="text-2xl font-bold tracking-tight">AIVIA RUNNING COSTS</h1>
              <p className="text-sm text-muted-foreground">Complete breakdown of costs to run AIVIA</p>
            </div>

            {/* Core Infrastructure */}
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Server className="h-4 w-4" />
                CORE INFRASTRUCTURE
              </h3>
              <div className="border border-foreground/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground text-background">
                    <tr>
                      <th className="text-left p-2">Service</th>
                      <th className="text-left p-2">Cost</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/20">
                      <td className="p-2">Lovable Subscription</td>
                      <td className="p-2">~£20-80/month</td>
                      <td className="p-2 text-muted-foreground">Includes cloud hosting</td>
                    </tr>
                    <tr>
                      <td className="p-2">Custom Domain</td>
                      <td className="p-2">~£10-15/year</td>
                      <td className="p-2 text-muted-foreground">Optional</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Phone System */}
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                PHONE SYSTEM (TWILIO)
              </h3>
              <div className="border border-foreground/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground text-background">
                    <tr>
                      <th className="text-left p-2">Service</th>
                      <th className="text-left p-2">Cost</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/20">
                      <td className="p-2">Phone Number</td>
                      <td className="p-2">~£1-3/month</td>
                      <td className="p-2 text-muted-foreground">Per number</td>
                    </tr>
                    <tr className="border-b border-foreground/20">
                      <td className="p-2">Voice Minutes</td>
                      <td className="p-2">~£0.015-0.02/min</td>
                      <td className="p-2 text-muted-foreground">Inbound + Outbound</td>
                    </tr>
                    <tr>
                      <td className="p-2">SMS Messages</td>
                      <td className="p-2">~£0.04/SMS</td>
                      <td className="p-2 text-muted-foreground">Confirmations</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Services */}
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI SERVICES (OPENAI)
              </h3>
              <div className="border border-foreground/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground text-background">
                    <tr>
                      <th className="text-left p-2">Service</th>
                      <th className="text-left p-2">Cost</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2">Realtime Voice API</td>
                      <td className="p-2">~$0.002-0.06/1K tokens</td>
                      <td className="p-2 text-muted-foreground">AI conversations</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Optional Services */}
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                OPTIONAL SERVICES
              </h3>
              <div className="border border-foreground/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground text-background">
                    <tr>
                      <th className="text-left p-2">Service</th>
                      <th className="text-left p-2">Cost</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/20">
                      <td className="p-2">Resend (Email)</td>
                      <td className="p-2">Free / ~$20/month</td>
                      <td className="p-2 text-muted-foreground">Free: 3K/month</td>
                    </tr>
                    <tr>
                      <td className="p-2 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Stripe
                      </td>
                      <td className="p-2">1.5% + 20p/txn</td>
                      <td className="p-2 text-muted-foreground">Deposits</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example Calculation */}
            <div className="border-2 border-foreground p-4 space-y-3">
              <div className="inline-block bg-foreground text-background px-2 py-1 text-sm font-bold">
                EXAMPLE: TYPICAL SALON (PER MONTH)
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Lovable Subscription</span>
                  <span>~£30</span>
                </div>
                <div className="flex justify-between">
                  <span>Twilio Number (1)</span>
                  <span>~£2</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice Minutes (200 min)</span>
                  <span>~£4</span>
                </div>
                <div className="flex justify-between">
                  <span>SMS (50 messages)</span>
                  <span>~£2</span>
                </div>
                <div className="flex justify-between">
                  <span>OpenAI (~500K tokens)</span>
                  <span>~£3</span>
                </div>
                <div className="flex justify-between">
                  <span>Resend (Free tier)</span>
                  <span>£0</span>
                </div>
                <div className="border-t border-foreground pt-2 mt-2 font-bold flex justify-between">
                  <span>TOTAL RUNNING COST</span>
                  <span>~£41/month</span>
                </div>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="border border-foreground/30 p-4 text-center">
              <p className="font-bold">PROFIT MARGIN</p>
              <p className="text-sm text-muted-foreground mt-1">
                Customer pays: <span className="font-semibold text-foreground">£85/month</span> | 
                Your cost: <span className="font-semibold text-foreground">~£41/month</span> | 
                Profit: <span className="font-semibold text-foreground">~£44/month per customer</span>
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
