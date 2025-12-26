import { Calendar, XCircle, RefreshCw, Image, MapPin, Phone, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PublicLandingPageProps {
  businessName: string;
  welcomeMessage: string | null;
  address: string;
  phone: string;
  website: string | null;
  hasGallery: boolean;
  onMakeBooking: () => void;
  onCancelBooking: () => void;
  onRescheduleBooking: () => void;
  onViewGallery: () => void;
}

export const PublicLandingPage = ({
  businessName,
  welcomeMessage,
  address,
  phone,
  website,
  hasGallery,
  onMakeBooking,
  onCancelBooking,
  onRescheduleBooking,
  onViewGallery,
}: PublicLandingPageProps) => {
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
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Gallery Link */}
      {hasGallery && (
        <div className="text-center">
          <Button variant="outline" size="lg" onClick={onViewGallery} className="gap-2">
            <Image className="h-5 w-5" />
            View Our Work
          </Button>
        </div>
      )}

      {/* Contact Info Footer - before More Options */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 py-6 border-t">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="text-sm md:text-base">{address}</span>
        </div>
        
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-5 w-5 text-primary" />
          <a href={`tel:${phone}`} className="text-sm md:text-base hover:text-foreground transition-colors">
            {phone}
          </a>
        </div>
        
        {website && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-5 w-5 text-primary" />
            <a 
              href={website.startsWith('http') ? website : `https://${website}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm md:text-base hover:text-foreground transition-colors"
            >
              Visit Website
            </a>
          </div>
        )}
      </div>

      {/* Action Cards - More Options */}
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
    </div>
  );
};
