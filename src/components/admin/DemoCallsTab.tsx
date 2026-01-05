import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Lightbulb } from "lucide-react";
import { DemoCallPlayer, DemoIcons } from "./DemoCallPlayer";

export const DemoCallsTab = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-foreground text-background">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">DEMO CALLS</CardTitle>
              <CardDescription>
                Play realistic call demos to show clients how AIVIA handles different scenarios
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tips */}
      <Card className="border-2 border-foreground bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 mt-0.5 text-foreground" />
            <div className="text-sm">
              <p className="font-bold mb-1">Sales Meeting Tip</p>
              <p className="text-muted-foreground">
                Play the booking demo first to showcase AIVIA's capabilities. 
                Then use rescheduling and cancellation demos to show how AIVIA handles 
                the full customer journey. The transcripts appear as the audio plays!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Players */}
      <div className="grid gap-6">
        <DemoCallPlayer
          scenario="booking"
          title="NEW BOOKING DEMO"
          description="Customer books a new haircut appointment"
          icon={DemoIcons.booking}
        />
        
        <DemoCallPlayer
          scenario="reschedule"
          title="RESCHEDULING DEMO"
          description="Customer changes their existing appointment"
          icon={DemoIcons.reschedule}
        />
        
        <DemoCallPlayer
          scenario="cancel"
          title="CANCELLATION DEMO"
          description="Customer cancels their appointment"
          icon={DemoIcons.cancel}
        />
      </div>
    </div>
  );
};
