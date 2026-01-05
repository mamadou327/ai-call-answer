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
    
    // Header - Black neobrutalist style
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FEATURE COMPARISON", pageWidth / 2, 22, { align: "center" });
    
    // Intro
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("See how AIVIA compares to traditional alternatives", pageWidth / 2, 48, { align: "center" });
    
    // Main comparison table with black headers
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
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 45, halign: "center" },
        3: { cellWidth: 40, halign: "center" },
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.5,
    });
    
    // Cost comparison section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("COST COMPARISON (ANNUAL)", 20, finalY);
    
    // Underline
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.line(20, finalY + 2, 120, finalY + 2);
    
    autoTable(doc, {
      startY: finalY + 8,
      head: [["Option", "Annual Cost", "Hidden Costs"]],
      body: [
        ["AIVIA", "~£1,000/year", "None"],
        ["Part-time Receptionist", "£10,000+/year", "NI, training, cover"],
        ["Full-time Receptionist", "£20,000+/year", "NI, training, cover, sick pay"],
        ["Missed Calls (doing nothing)", "£0", "Lost bookings: £5,000-20,000+"],
      ],
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.5,
    });
    
    // Key differentiators - black bordered box
    const costTableY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(15, costTableY, pageWidth - 30, 40, "FD");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("KEY AIVIA DIFFERENTIATORS", 20, costTableY + 10);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    
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
    
    // Footer - black bar
    doc.setFillColor(0, 0, 0);
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
          <div className="space-y-6 p-4 bg-background border-2 border-foreground">
            {/* Header */}
            <div className="bg-foreground text-background p-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">FEATURE COMPARISON</h1>
              <p className="text-sm opacity-90 mt-1">See how AIVIA compares</p>
            </div>
            
            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-foreground">
                <thead>
                  <tr className="bg-foreground text-background">
                    <th className="p-3 text-left font-bold border-2 border-foreground">Feature</th>
                    <th className="p-3 text-center font-bold border-2 border-foreground">AIVIA</th>
                    <th className="p-3 text-center font-bold border-2 border-foreground">Receptionist</th>
                    <th className="p-3 text-center font-bold border-2 border-foreground">Voicemail</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-muted" : "bg-background"}>
                      <td className="p-3 font-medium border-2 border-foreground">{row.feature}</td>
                      <td className="p-3 text-center border-2 border-foreground">{renderIcon(row.aivia)}</td>
                      <td className="p-3 text-center border-2 border-foreground">{renderIcon(row.receptionist)}</td>
                      <td className="p-3 text-center border-2 border-foreground">{renderIcon(row.voicemail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Cost Comparison */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold border-b-2 border-foreground pb-2">ANNUAL COST COMPARISON</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 bg-foreground text-background border-2 border-foreground">
                  <p className="font-bold">AIVIA</p>
                  <p className="text-2xl font-bold">~£1,000/year</p>
                  <p className="text-xs opacity-80">No hidden costs</p>
                </div>
                <div className="p-4 bg-muted border-2 border-foreground">
                  <p className="font-bold">Full-time Receptionist</p>
                  <p className="text-2xl font-bold">£20,000+/year</p>
                  <p className="text-xs text-muted-foreground">Plus NI, training, sick pay</p>
                </div>
              </div>
            </div>
            
            {/* Key Differentiators */}
            <div className="bg-background border-2 border-foreground p-4">
              <h3 className="font-bold mb-3">KEY AIVIA DIFFERENTIATORS</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Zero-latency AI - Real-time conversations, no awkward pauses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Never calls in sick, never takes holidays
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Remembers every customer interaction
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
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