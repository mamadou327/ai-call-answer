import { useState } from "react";
import { Calendar, XCircle, RefreshCw, Image, MapPin, Phone, Globe, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PublicContactForm } from "./PublicContactForm";
import { PublicOpeningHours } from "./PublicOpeningHours";

interface PolicySettings {
  minBookingNoticeHours: number | null;
  maxDaysAdvance: number | null;
  minCancellationNoticeHours: number | null;
  minRescheduleNoticeHours: number | null;
  cancellationPolicy: string | null;
}

interface OpeningHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface PublicLandingPageProps {
  businessName: string;
  businessSlug: string;
  businessType?: string | null;
  welcomeMessage: string | null;
  address: string;
  phone: string;
  website: string | null;
  hasGallery: boolean;
  policies?: PolicySettings;
  openingHours?: OpeningHour[];
  onMakeBooking: () => void;
  onCancelBooking: () => void;
  onRescheduleBooking: () => void;
  onViewGallery: () => void;
}

const RESTAURANT_TYPES = ["restaurant_pickup", "restaurant_dine_in", "restaurant_hybrid"];

// Helper function to format policy text professionally
const formatPolicyText = (rawPolicy: string): string => {
  // Capitalize first letter and ensure proper punctuation
  let formatted = rawPolicy.trim();
  
  // Capitalize first letter
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  // Ensure it ends with a period if it doesn't have ending punctuation
  if (formatted.length > 0 && !formatted.match(/[.!?]$/)) {
    formatted += '.';
  }
  
  // Professional replacements to make text sound more formal
  formatted = formatted
    .replace(/\bno refunds\b/gi, 'Please note that refunds are not available')
    .replace(/\byou can come in\b/gi, 'you are welcome to visit us')
    .replace(/\bspeak to someone\b/gi, 'speak with a member of our team')
    .replace(/\byou can call\b/gi, 'you may contact us by phone')
    .replace(/\bi can transfer you\b/gi, 'we will be happy to connect you')
    .replace(/\bthe business owner\b/gi, 'our management team')
    .replace(/\band I\b/gi, ', or')
    .replace(/\bbut\b/gi, 'however,');
  
  return formatted;
};

export const PublicLandingPage = ({
  businessName,
  businessSlug,
  businessType,
  welcomeMessage,
  address,
  phone,
  website,
  hasGallery,
  policies,
  openingHours,
  onMakeBooking,
  onCancelBooking,
  onRescheduleBooking,
  onViewGallery,
}: PublicLandingPageProps) => {
  const [policiesOpen, setPoliciesOpen] = useState(false);
  
  const isRestaurant = RESTAURANT_TYPES.includes(businessType || "");

  const formatPolicyItem = (label: string, value: number | null, unit: string) => {
    if (value === null) return null;
    return (
      <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} {unit}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8 md:py-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
          Welcome to{" "}
          <span className="block mt-2">{businessName}</span>
        </h1>
        
        {welcomeMessage && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6">
            {welcomeMessage}
          </p>
        )}

        {/* Primary CTA */}
        <div className="mt-8">
          <Button 
            size="lg" 
            onClick={onMakeBooking}
            className="text-lg px-8 py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            {isRestaurant ? "Order Now" : "Book Appointment"}
          </Button>
        </div>
      </div>

      {/* Gallery Link */}
      {hasGallery && (
        <div className="text-center">
          <Button variant="outline" size="lg" onClick={onViewGallery} className="gap-2">
            <Image className="h-5 w-5" />
            {isRestaurant ? "View Menu" : "View Our Work"}
          </Button>
        </div>
      )}

      {/* Action Cards - More Options (hide for restaurants) */}
      {!isRestaurant && (
        <div className="pt-4 border-t">
          <h2 className="text-xl font-semibold text-center mb-6">More Options</h2>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={onCancelBooking}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-base">Cancel Booking</CardTitle>
                <CardDescription className="text-sm">
                  Cancel an existing appointment
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={onRescheduleBooking}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
                  <RefreshCw className="h-5 w-5 text-amber-500" />
                </div>
                <CardTitle className="text-base">Reschedule</CardTitle>
                <CardDescription className="text-sm">
                  Change the date/time of your booking
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}

      {/* Footer with Contact Info and Policies */}
      <footer className="pt-8 border-t mt-8">
        <div className="flex flex-col items-center gap-6">
          {/* Contact Info */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm">{address}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${phone}`} className="text-sm hover:text-foreground transition-colors">
                {phone}
              </a>
            </div>
            
            {website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4 text-primary" />
                <a 
                  href={website.startsWith('http') ? website : `https://${website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm hover:text-foreground transition-colors"
                >
                  Visit Website
                </a>
              </div>
            )}
          </div>

          {/* Opening Hours */}
          {openingHours && openingHours.length > 0 && (
            <PublicOpeningHours openingHours={openingHours} />
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Policies Button */}
            <Dialog open={policiesOpen} onOpenChange={setPoliciesOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <FileText className="h-4 w-4" />
                  Policies
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Booking Policies</DialogTitle>
                  <DialogDescription>
                    Our booking, cancellation, and rescheduling policies
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1 mt-4">
                  {policies?.minBookingNoticeHours !== null && policies?.minBookingNoticeHours !== undefined && (
                    formatPolicyItem("Minimum booking notice", policies.minBookingNoticeHours, "hours")
                  )}
                  {policies?.maxDaysAdvance !== null && policies?.maxDaysAdvance !== undefined && (
                    formatPolicyItem("Book up to", policies.maxDaysAdvance, "days in advance")
                  )}
                  {policies?.minCancellationNoticeHours !== null && policies?.minCancellationNoticeHours !== undefined && (
                    formatPolicyItem("Cancellation notice required", policies.minCancellationNoticeHours, "hours")
                  )}
                  {policies?.minRescheduleNoticeHours !== null && policies?.minRescheduleNoticeHours !== undefined && (
                    formatPolicyItem("Reschedule notice required", policies.minRescheduleNoticeHours, "hours")
                  )}
                  
                  {policies?.cancellationPolicy && (
                    <div className="pt-4 mt-4 border-t">
                      <h4 className="font-medium mb-2">Policy</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {formatPolicyText(policies.cancellationPolicy)}
                      </p>
                    </div>
                  )}

                  {!policies?.minBookingNoticeHours && 
                   !policies?.maxDaysAdvance && 
                   !policies?.minCancellationNoticeHours && 
                   !policies?.minRescheduleNoticeHours && 
                   !policies?.cancellationPolicy && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No specific policies have been set by this business.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Contact Form */}
            <PublicContactForm businessSlug={businessSlug} businessName={businessName} />
          </div>
        </div>
      </footer>
    </div>
  );
};
