import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sparkles } from "lucide-react";
import { SalesPitchDocument } from "./sales-kit/SalesPitchDocument";
import { HowItWorksDocument } from "./sales-kit/HowItWorksDocument";
import { FeatureComparisonDocument } from "./sales-kit/FeatureComparisonDocument";
import { ROICalculatorDocument } from "./sales-kit/ROICalculatorDocument";
import { DemoScriptDocument } from "./sales-kit/DemoScriptDocument";
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

// Helper to add header to a page
const addPageHeader = async (doc: jsPDF, title: string, logoData: string | null) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 18;
  
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(0, headerHeight, pageWidth, headerHeight);
  
  if (logoData) {
    doc.addImage(logoData, "PNG", 8, 2, 14, 14);
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 12, { align: "center" });
};

// Helper to add footer
const addPageFooter = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("www.aiviaapp.co.uk  |  Mo@aiviaapp.co.uk", pageWidth / 2, 288, { align: "center" });
};

// Generate combined PDF with all documents
const generateCombinedPdf = async () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Load logo once
  let logoData: string | null = null;
  try {
    logoData = await loadImageAsBase64(aiviaLogo);
  } catch (e) {
    // Continue without logo
  }

  // === PAGE 1: Sales Pitch ===
  await addPageHeader(doc, "SALES PITCH ONE-PAGER", logoData);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NEVER MISS ANOTHER BOOKING", pageWidth / 2, 38, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Your AI receptionist answers calls 24/7, books appointments, and remembers customers", pageWidth / 2, 46, { align: "center" });

  const boxWidth = (pageWidth - 45) / 2;
  const leftX = 15;
  const rightX = leftX + boxWidth + 15;
  const boxY = 55;
  const boxHeight = 52;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(leftX, boxY, boxWidth, boxHeight, "S");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("THE PROBLEM", leftX + 6, boxY + 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const painPoints = ["X  Missing calls = Missing money", "X  80% won't leave voicemail", "X  Receptionist costs £20,000+/yr", "X  Too busy with clients to answer"];
  let yPos = boxY + 20;
  painPoints.forEach((point) => { doc.text(point, leftX + 6, yPos); yPos += 8; });

  doc.rect(rightX, boxY, boxWidth, boxHeight, "S");
  doc.setFillColor(0, 0, 0);
  doc.rect(rightX + 4, boxY + 4, 55, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("THE SOLUTION", rightX + 8, boxY + 9);
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const solutions = ["  - Zero-latency real-time AI", "  - Books directly into calendar", "  - Remembers returning customers", "  - Works 24/7/365"];
  yPos = boxY + 22;
  solutions.forEach((solution) => { doc.text(solution, rightX + 6, yPos); yPos += 8; });

  const featuresY = boxY + boxHeight + 10;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, featuresY, pageWidth - 30, 28, "S");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("WHAT YOU GET", pageWidth / 2, featuresY + 8, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("AI Voice Receptionist  -  Online Booking Page  -  Customer Database", pageWidth / 2, featuresY + 17, { align: "center" });
  doc.text("SMS Notifications  -  Dashboard & Analytics  -  Deposit Collection", pageWidth / 2, featuresY + 24, { align: "center" });

  const pricingY = featuresY + 38;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, pricingY, pageWidth - 30, 28, "S");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("LESS THAN £3 PER DAY", pageWidth / 2, pricingY + 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Pays for itself with just 2-3 bookings per month", pageWidth / 2, pricingY + 22, { align: "center" });

  const howY = pricingY + 40;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("HOW IT WORKS", 20, howY);
  doc.setLineWidth(0.5);
  doc.line(20, howY + 2, 60, howY + 2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const steps = ["1.  Customer calls your number", "2.  AI answers instantly (zero wait time)", "3.  Books appointment in real-time", "4.  Sends SMS confirmation to customer", "5.  Updates your dashboard automatically"];
  yPos = howY + 12;
  steps.forEach((step) => { doc.text(step, 20, yPos); yPos += 7; });

  addPageFooter(doc);

  // === PAGE 2: How It Works ===
  doc.addPage();
  await addPageHeader(doc, "HOW AIVIA WORKS", logoData);
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("A complete AI-powered phone receptionist that integrates with your business", pageWidth / 2, 28, { align: "center" });

  yPos = 42;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("THE CALL FLOW", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 55, yPos + 2);

  const callSteps = [
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
  callSteps.forEach((step) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(xPos, stepY, stepBoxWidth, stepBoxHeight, "FD");
    doc.setFillColor(0, 0, 0);
    doc.circle(xPos + stepBoxWidth / 2, stepY + 6, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(step.num, xPos + stepBoxWidth / 2, stepY + 7.5, { align: "center" });
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

  yPos = stepY + stepBoxHeight + 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("TECHNOLOGY STACK", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 65, yPos + 2);

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
  dashboardFeatures.forEach((feature) => { doc.text(feature, 20, yPos); yPos += 7; });

  yPos += 8;
  const integrationY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, integrationY, pageWidth - 30, 22, "S");
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

  addPageFooter(doc);

  // === PAGE 3: Feature Comparison ===
  doc.addPage();
  await addPageHeader(doc, "FEATURE COMPARISON", logoData);
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("See how AIVIA compares to traditional alternatives", pageWidth / 2, 28, { align: "center" });

  const tableData = [
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
  ];

  autoTable(doc, {
    startY: 35,
    head: [["Feature", "AIVIA", "Receptionist", "Voicemail"]],
    body: tableData,
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 9, fontStyle: "bold", lineWidth: 0.5, lineColor: [0, 0, 0] },
    bodyStyles: { fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.3, textColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 50, fontStyle: "bold" }, 1: { cellWidth: 35, halign: "center" }, 2: { cellWidth: 40, halign: "center" }, 3: { cellWidth: 35, halign: "center" } },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.3,
    styles: { cellPadding: 3 },
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY || 150;
  const finalY = tableEndY + 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("ANNUAL COST COMPARISON", 20, finalY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(20, finalY + 2, 90, finalY + 2);

  autoTable(doc, {
    startY: finalY + 6,
    head: [["Option", "Annual Cost", "Hidden Costs"]],
    body: [["AIVIA", "~£1,000/year", "None"], ["Part-time Receptionist", "£10,000+/year", "NI, training, cover"], ["Full-time Receptionist", "£20,000+/year", "NI, training, sick pay"], ["Missed Calls (doing nothing)", "£0", "Lost: £5,000-20,000+"]],
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 9, fontStyle: "bold", lineWidth: 0.5, lineColor: [0, 0, 0] },
    bodyStyles: { fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.3, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.3,
    styles: { cellPadding: 3 },
  });

  const costTableEndY = (doc as any).lastAutoTable?.finalY || 200;
  const costTableY = costTableEndY + 10;
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
    "  - Zero-latency AI - Real-time conversations with no awkward pauses",
    "  - Never calls in sick, never takes holidays, never needs a break",
    "  - Remembers every customer interaction and preference",
    "  - Scales instantly - handles 1 or 100 calls simultaneously",
  ];
  yPos = costTableY + 16;
  differentiators.forEach((diff) => { doc.text(diff, 20, yPos); yPos += 6; });

  addPageFooter(doc);

  // === PAGE 4: ROI Calculator ===
  doc.addPage();
  await addPageHeader(doc, "ROI CALCULATOR", logoData);
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("See how AIVIA pays for itself", pageWidth / 2, 28, { align: "center" });

  yPos = 42;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("THE COST OF MISSED CALLS", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 80, yPos + 2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const problems = ["  - Average missed calls per week: 5-10", "  - Average booking value: £35", "  - Customers who call competitors after voicemail: 80%"];
  yPos += 10;
  problems.forEach((p) => { doc.text(p, 20, yPos); yPos += 7; });

  yPos += 8;
  const lostY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, lostY, pageWidth - 30, 42, "S");
  doc.setFillColor(0, 0, 0);
  doc.rect(20, lostY + 4, 70, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("POTENTIAL LOST REVENUE", 23, lostY + 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const lostCalc = ["5 missed calls/week x £35 avg booking = £175/week lost", "£175/week x 52 weeks = £9,100/year in lost bookings", "Even at just 2 missed calls/week = £3,640/year lost"];
  yPos = lostY + 22;
  lostCalc.forEach((calc) => { doc.text(calc, 20, yPos); yPos += 8; });

  yPos = lostY + 52;
  const investY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, investY, pageWidth - 30, 42, "S");
  doc.setFillColor(0, 0, 0);
  doc.rect(20, investY + 4, 55, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("AIVIA INVESTMENT", 23, investY + 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const investment = ["AIVIA monthly cost: ~£85/month", "AIVIA annual cost: ~£1,000/year", "Break-even: Just 2-3 recovered bookings per month"];
  yPos = investY + 22;
  investment.forEach((inv) => { doc.text(inv, 20, yPos); yPos += 8; });

  yPos = investY + 55;
  const roiY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(15, roiY, pageWidth - 30, 45, "S");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("YOUR POTENTIAL ROI", pageWidth / 2, roiY + 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Recovered revenue: £9,100 (capturing 5 calls/week)", pageWidth / 2, roiY + 22, { align: "center" });
  doc.text("AIVIA cost: £1,000", pageWidth / 2, roiY + 29, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("NET GAIN: £8,100/YEAR (810% ROI)", pageWidth / 2, roiY + 40, { align: "center" });

  addPageFooter(doc);

  // === PAGE 5: Demo Script ===
  doc.addPage();
  await addPageHeader(doc, "DEMO SCRIPT GUIDE", logoData);
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Use this script for your sales conversations", pageWidth / 2, 28, { align: "center" });

  yPos = 42;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("15-SECOND OPENER", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 60, yPos + 2);

  yPos += 10;
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(15, yPos, pageWidth - 30, 22, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(40, 40, 40);
  const opener = '"What would it mean for your business if you never missed another booking call? AIVIA is an AI receptionist that answers your phone 24/7, books appointments, and remembers your customers."';
  const openerLines = doc.splitTextToSize(opener, pageWidth - 40);
  doc.text(openerLines, 20, yPos + 8);

  yPos += 32;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PAIN-FOCUSED QUESTIONS", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 75, yPos + 2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const questions = ['1. "How many calls do you miss while you\'re with clients?"', '2. "What happens when someone calls after hours?"', '3. "How much is a typical booking worth to you?"', '4. "Have you calculated how much missed calls cost you?"'];
  yPos += 10;
  questions.forEach((q) => { doc.text(q, 20, yPos); yPos += 8; });

  yPos += 8;
  const momentsY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, momentsY, pageWidth - 30, 45, "S");
  doc.setFillColor(0, 0, 0);
  doc.rect(20, momentsY + 4, 65, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text('"WAIT, REALLY?" MOMENTS', 23, momentsY + 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const moments = ["- It recognizes returning customers and greets them by name", "- It can book a family of 4 with different services in one call", "- Every call is transcribed - see exactly what was said", "- Works 24/7 including bank holidays - no sick days"];
  yPos = momentsY + 18;
  moments.forEach((m) => { doc.text(m, 20, yPos); yPos += 6; });

  yPos += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("OBJECTION HANDLERS", 20, yPos);
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 68, yPos + 2);
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const objections = [
    ['"It\'s too expensive"', "Less than £3/day - one booking pays for the month"],
    ['"Customers prefer humans"', "80% prefer immediate AI over waiting for callback"],
    ['"What if it makes mistakes?"', "You see every transcript - and it learns your rules"],
    ['"I\'m too busy to set it up"', "We handle everything - you just approve"],
  ];
  yPos += 10;
  objections.forEach(([obj, resp]) => {
    doc.setFont("helvetica", "bold");
    doc.text(obj, 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text("  ->  " + resp, 20 + doc.getTextWidth(obj) + 2, yPos);
    yPos += 10;
  });

  yPos += 8;
  const closeY = yPos;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, closeY, pageWidth - 30, 14, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text('CLOSE: "Ready to stop losing bookings? Let me show you how it sounds..."', 20, closeY + 9);

  addPageFooter(doc);

  doc.save("AIVIA-Complete-Sales-Kit.pdf");
};

export const AiviaSalesKitTab = () => {
  const downloadAllPDFs = () => {
    void generateCombinedPdf();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-foreground text-background">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">AIVIA SALES KIT</CardTitle>
                <CardDescription>
                  All the documents you need for sales presentations
                </CardDescription>
              </div>
            </div>
            <Button onClick={downloadAllPDFs} className="gap-2 bg-foreground text-background hover:bg-foreground/90 border-2 border-foreground">
              <Download className="h-4 w-4" />
              Download All PDFs
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Tips */}
      <Card className="border-2 border-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            QUICK TIPS FOR YOUR MEETING
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Start with Pain</p>
              <p className="text-muted-foreground">Ask about missed calls before showing solutions</p>
            </div>
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Demo the Voice</p>
              <p className="text-muted-foreground">Play a sample call - the AI voice sells itself</p>
            </div>
            <div className="p-3 border-2 border-foreground">
              <p className="font-bold mb-1">Close on ROI</p>
              <p className="text-muted-foreground">"One booking pays for the month"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SalesPitchDocument />
        <HowItWorksDocument />
        <FeatureComparisonDocument />
        <ROICalculatorDocument />
        <DemoScriptDocument />
      </div>
    </div>
  );
};