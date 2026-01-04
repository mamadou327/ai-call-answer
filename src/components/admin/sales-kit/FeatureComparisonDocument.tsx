import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Eye, Check, X, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const FeatureComparisonDocument = () => {
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
    doc.text("Feature Comparison", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("See how AIVIA compares to traditional alternatives", pageWidth / 2, 48, { align: "center" });
    
    // Main comparison table
    autoTable(doc, {
      startY: 55,
      head: [["Feature", "AIVIA", "Receptionist", "Voicemail"]],
      body: [
        ["24/7 Availability", "✓", "✗ (9-5 only)", "✓"],
        ["Books Appointments", "✓ (Instant)", "✓ (Manual)", "✗"],
        ["Remembers Customers", "✓", "Sometimes", "✗"],
        ["Handles Group Bookings", "✓", "✓", "✗"],
        ["SMS Confirmations", "✓ (Automatic)", "Manual", "✗"],
        ["Multiple Languages", "✓", "Limited", "✗"],
        ["Sick Days / Holidays", "None", "Yes", "N/A"],
        ["Training Required", "None", "Weeks", "N/A"],
        ["Scales with Business", "✓ Unlimited", "Limited", "N/A"],
        ["Call Transcripts", "✓ (Every call)", "Manual notes", "✗"],
      ],
      headStyles: {
        fillColor: [139, 92, 246],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 45, halign: "center" },
        3: { cellWidth: 40, halign: "center" },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255],
      },
    });
    
    // Cost comparison section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Cost Comparison (Annual)", 20, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [["Option", "Annual Cost", "Hidden Costs"]],
      body: [
        ["AIVIA", "~£1,000/year", "None"],
        ["Part-time Receptionist", "£10,000+/year", "NI, training, cover"],
        ["Full-time Receptionist", "£20,000+/year", "NI, training, cover, sick pay"],
        ["Missed Calls (doing nothing)", "£0", "Lost bookings: £5,000-20,000+"],
      ],
      headStyles: {
        fillColor: [139, 92, 246],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255],
      },
    });
    
    // Key differentiators
    const costTableY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFillColor(245, 245, 255);
    doc.rect(15, costTableY, pageWidth - 30, 35, "F");
    doc.setDrawColor(139, 92, 246);
    doc.rect(15, costTableY, pageWidth - 30, 35, "S");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 92, 246);
    doc.text("Key AIVIA Differentiators", 20, costTableY + 10);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    const differentiators = [
      "✓ Zero-latency AI - Real-time conversations with no awkward pauses",
      "✓ Never calls in sick, never takes holidays, never needs a break",
      "✓ Remembers every customer interaction and preference",
      "✓ Scales instantly - handles 1 or 100 calls simultaneously",
    ];
    
    let yPos = costTableY + 18;
    differentiators.forEach(diff => {
      doc.text(diff, 20, yPos);
      yPos += 7;
    });
    
    // Footer
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 285, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("www.aiviaapp.co.uk  |  hello@aiviaapp.co.uk", pageWidth / 2, 295, { align: "center" });
    
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
    if (value === true) return <Check className="h-4 w-4 text-green-500" />;
    if (value === false) return <X className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Feature Comparison</CardTitle>
              <CardDescription>AIVIA vs alternatives side-by-side</CardDescription>
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
          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 text-green-500" />
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
            <DialogTitle>Feature Comparison - Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 bg-background border rounded-lg">
            {/* Header */}
            <div className="bg-primary text-primary-foreground rounded-lg p-6 text-center">
              <h1 className="text-2xl font-bold">Feature Comparison</h1>
              <p className="text-sm opacity-90 mt-1">See how AIVIA compares</p>
            </div>
            
            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="p-3 text-left">Feature</th>
                    <th className="p-3 text-center">AIVIA</th>
                    <th className="p-3 text-center">Receptionist</th>
                    <th className="p-3 text-center">Voicemail</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="p-3 font-medium">{row.feature}</td>
                      <td className="p-3 text-center">{renderIcon(row.aivia)}</td>
                      <td className="p-3 text-center">{renderIcon(row.receptionist)}</td>
                      <td className="p-3 text-center">{renderIcon(row.voicemail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Cost Comparison */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Annual Cost Comparison</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="font-bold text-primary">AIVIA</p>
                  <p className="text-2xl font-bold">~£1,000/year</p>
                  <p className="text-xs text-muted-foreground">No hidden costs</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-bold">Full-time Receptionist</p>
                  <p className="text-2xl font-bold">£20,000+/year</p>
                  <p className="text-xs text-muted-foreground">Plus NI, training, sick pay</p>
                </div>
              </div>
            </div>
            
            {/* Key Differentiators */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Key AIVIA Differentiators</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Zero-latency AI - Real-time conversations, no awkward pauses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Never calls in sick, never takes holidays
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Remembers every customer interaction
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Scales instantly - handles unlimited calls
                </li>
              </ul>
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
