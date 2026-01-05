import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Check, X, Minus } from "lucide-react";
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

export const FeatureComparisonDocument = () => {
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
    doc.text("FEATURE COMPARISON", pageWidth / 2 + 5, 12, { align: "center" });
    
    // Subtitle
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("See how AIVIA compares to traditional alternatives", pageWidth / 2, 28, { align: "center" });
    
    // Main comparison table - clean design with YES/NO text
    autoTable(doc, {
      startY: 35,
      head: [["Feature", "AIVIA", "Receptionist", "Voicemail"]],
      body: [
        ["24/7 Availability", "YES", "NO (9-5 only)", "YES"],
        ["Books Appointments", "YES (Instant)", "YES (Manual)", "NO"],
        ["Remembers Customers", "YES", "Sometimes", "NO"],
        ["Handles Group Bookings", "YES", "YES", "NO"],
        ["SMS Confirmations", "YES (Auto)", "Manual", "NO"],
        ["Multiple Languages", "YES", "Limited", "NO"],
        ["Sick Days / Holidays", "None", "Yes", "N/A"],
        ["Training Required", "None", "Weeks", "N/A"],
        ["Scales with Business", "Unlimited", "Limited", "N/A"],
        ["Call Transcripts", "YES (Every call)", "Manual notes", "NO"],
      ],
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: "bold",
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 8,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        textColor: [40, 40, 40],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 40, halign: "center" },
        3: { cellWidth: 35, halign: "center" },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      tableLineColor: [180, 180, 180],
      tableLineWidth: 0.3,
      styles: {
        cellPadding: 3,
      },
    });
    
    // Cost comparison section
    const finalY = (doc as any).lastAutoTable.finalY + 12;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("ANNUAL COST COMPARISON", 20, finalY);
    
    // Simple underline
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(20, finalY + 2, 90, finalY + 2);
    
    autoTable(doc, {
      startY: finalY + 6,
      head: [["Option", "Annual Cost", "Hidden Costs"]],
      body: [
        ["AIVIA", "~£1,000/year", "None"],
        ["Part-time Receptionist", "£10,000+/year", "NI, training, cover"],
        ["Full-time Receptionist", "£20,000+/year", "NI, training, sick pay"],
        ["Missed Calls (doing nothing)", "£0", "Lost: £5,000-20,000+"],
      ],
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: "bold",
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 8,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        textColor: [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      tableLineColor: [180, 180, 180],
      tableLineWidth: 0.3,
      styles: {
        cellPadding: 3,
      },
    });
    
    // Key differentiators - white box with thin border
    const costTableY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(15, costTableY, pageWidth - 30, 38, "S");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("KEY AIVIA DIFFERENTIATORS", 20, costTableY + 8);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    
    const differentiators = [
      "•  Zero-latency AI - Real-time conversations with no awkward pauses",
      "•  Never calls in sick, never takes holidays, never needs a break",
      "•  Remembers every customer interaction and preference",
      "•  Scales instantly - handles 1 or 100 calls simultaneously",
    ];
    
    let yPos = costTableY + 16;
    differentiators.forEach(diff => {
      doc.text(diff, 20, yPos);
      yPos += 6;
    });
    
    // Clean footer - just text, no black bar
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });
    
    doc.save("AIVIA-Feature-Comparison.pdf");
  };

  const handlePrint = () => {
    window.print();
  };

  const comparisonData = [
    { feature: "24/7 Availability", aivia: true, receptionist: false, voicemail: true },
    { feature: "Books Appointments", aivia: true, receptionist: true, voicemail: false },
    { feature: "Remembers Customers", aivia: true, receptionist: "partial", voicemail: false },
    { feature: "Group Bookings", aivia: true, receptionist: true, voicemail: false },
    { feature: "SMS Confirmations", aivia: true, receptionist: "partial", voicemail: false },
    { feature: "No Sick Days", aivia: true, receptionist: false, voicemail: true },
    { feature: "No Training Needed", aivia: true, receptionist: false, voicemail: true },
    { feature: "Call Transcripts", aivia: true, receptionist: false, voicemail: false },
  ];

  const renderIcon = (value: boolean | string) => {
    if (value === true) return <Check className="h-4 w-4 text-foreground" />;
    if (value === false) return <X className="h-4 w-4 text-muted-foreground" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <>
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-[6px_6px_0px_0px_hsl(var(--foreground))] transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Feature Comparison</CardTitle>
              <CardDescription>AIVIA vs alternatives side-by-side</CardDescription>
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
              <Check className="h-4 w-4" />
              Visual Comparison Tables
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• AIVIA vs Receptionist</p>
              <p>• AIVIA vs Voicemail</p>
              <p>• Cost comparison</p>
              <p>• Key differentiators</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">Feature Comparison - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border border-foreground/20">
            {/* Header */}
            <div className="border-b border-foreground pb-3">
              <h1 className="text-xl font-bold tracking-tight">FEATURE COMPARISON</h1>
              <p className="text-sm text-muted-foreground mt-1">See how AIVIA compares</p>
            </div>
            
            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-foreground/30">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-3 text-left font-bold border border-foreground/30">Feature</th>
                    <th className="p-3 text-center font-bold border border-foreground/30">AIVIA</th>
                    <th className="p-3 text-center font-bold border border-foreground/30">Receptionist</th>
                    <th className="p-3 text-center font-bold border border-foreground/30">Voicemail</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/50"}>
                      <td className="p-3 font-medium border border-foreground/30">{row.feature}</td>
                      <td className="p-3 text-center border border-foreground/30">{renderIcon(row.aivia)}</td>
                      <td className="p-3 text-center border border-foreground/30">{renderIcon(row.receptionist)}</td>
                      <td className="p-3 text-center border border-foreground/30">{renderIcon(row.voicemail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Cost Comparison */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b border-foreground/30 pb-2">ANNUAL COST COMPARISON</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 border border-foreground/30 bg-muted/30">
                  <p className="font-bold">AIVIA</p>
                  <p className="text-2xl font-bold">~£1,000/year</p>
                  <p className="text-xs text-muted-foreground">No hidden costs</p>
                </div>
                <div className="p-4 border border-foreground/30">
                  <p className="font-bold">Full-time Receptionist</p>
                  <p className="text-2xl font-bold">£20,000+/year</p>
                  <p className="text-xs text-muted-foreground">Plus NI, training, sick pay</p>
                </div>
              </div>
            </div>
            
            {/* Key Differentiators */}
            <div className="border border-foreground/30 p-4">
              <h3 className="font-bold mb-3">KEY AIVIA DIFFERENTIATORS</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-foreground">•</span>
                  Zero-latency AI - Real-time conversations, no awkward pauses
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-foreground">•</span>
                  Never calls in sick, never takes holidays
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-foreground">•</span>
                  Remembers every customer interaction
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-foreground">•</span>
                  Scales instantly - handles unlimited calls
                </li>
              </ul>
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