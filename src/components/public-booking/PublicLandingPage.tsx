import { Calendar, XCircle, RefreshCw, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PublicLandingPageProps {
  businessName: string;
  welcomeMessage: string | null;
  hasGallery: boolean;
  onMakeBooking: () => void;
  onCancelBooking: () => void;
  onRescheduleBooking: () => void;
  onViewGallery: () => void;
}

export const PublicLandingPage = ({
  businessName,
  welcomeMessage,
  hasGallery,
  onMakeBooking,
  onCancelBooking,
  onRescheduleBooking,
  onViewGallery,
}: PublicLandingPageProps) => {
  return (
    <div className="space-y-6">
      {welcomeMessage && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{welcomeMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold">What would you like to do?</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onMakeBooking}
        >
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Make a Booking</CardTitle>
            <CardDescription>
              Book a new appointment with us
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={onMakeBooking}>
              Book Now
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onCancelBooking}
        >
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-lg">Cancel Booking</CardTitle>
            <CardDescription>
              Cancel an existing appointment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={onCancelBooking}>
              Cancel Booking
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onRescheduleBooking}
        >
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
              <RefreshCw className="h-6 w-6 text-amber-500" />
            </div>
            <CardTitle className="text-lg">Reschedule</CardTitle>
            <CardDescription>
              Change the date/time of your booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={onRescheduleBooking}>
              Reschedule
            </Button>
          </CardContent>
        </Card>
      </div>

      {hasGallery && (
        <div className="text-center pt-4">
          <Button variant="ghost" onClick={onViewGallery} className="gap-2">
            <Image className="h-4 w-4" />
            View Our Work
          </Button>
        </div>
      )}
    </div>
  );
};
