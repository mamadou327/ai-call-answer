import { Settings, Phone, LayoutDashboard, MessageSquare, ArrowRight, Plus, Users, Zap, Calendar, TrendingUp, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import DemoDashboard from "@/components/landing/DemoDashboard";

interface HowItWorksDialogProps {
  children: React.ReactNode;
}

const HowItWorksDialog = ({ children }: HowItWorksDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl md:text-3xl font-bold text-center">
            How Aivia Works for Your Business
          </DialogTitle>
          <p className="text-muted-foreground text-center mt-2">
            From missed calls to fully-managed bookings in a few minutes.
          </p>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <div className="space-y-10 pt-6">
            {/* Step 1 - Setup */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <h3 className="font-semibold text-lg">Set up your business in minutes</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11">
                Create your account, add your menu items, tables, opening hours and delivery options. Choose your Aivia phone number (or connect your existing line), and pick the AI voice and greeting you want customers to hear.
              </p>
              <div className="flex flex-wrap gap-2 pl-11">
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <Plus className="w-3.5 h-3.5 text-accent" />
                  Add menu
                </div>
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  Set tables
                </div>
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <Zap className="w-3.5 h-3.5 text-accent" />
                  Go live
                </div>
              </div>
            </div>

            {/* Step 2 - Call Flow */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <h3 className="font-semibold text-lg">Aivia answers every call, 24/7</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11">
                When a customer calls your number, Aivia picks up instantly with your restaurant name, speaks naturally, and asks how it can help. It understands what they say, checks your availability, and takes orders, makes reservations, or answers questions just like a real receptionist.
              </p>
              {/* Conversation Example */}
              <div className="bg-muted/50 rounded-xl p-4 ml-11 space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] text-sm">
                    "Hi, I'd like to make a reservation for 4 people tomorrow at 7pm."
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] text-sm">
                    "Of course! I have a table available at 7pm or 7:30pm. Which would you prefer?"
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] text-sm">
                    "7pm please, and can we get a table by the window?"
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] text-sm">
                    "Perfect! I've reserved a window table for 4 at 7pm tomorrow. You'll receive a confirmation text shortly."
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 - Dashboard */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <h3 className="font-semibold text-lg">You see everything in one dashboard</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11">
                Every call, order, and reservation appears in your Aivia dashboard. You can see today's bookings, upcoming orders, table availability, and simple analytics like how many calls Aivia answered and how much revenue was generated.
              </p>
              {/* Actual Dashboard Preview */}
              <div className="ml-11 -mx-2 md:mx-0">
                <div className="bg-muted/30 rounded-xl p-2 md:p-4 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 text-center">👆 This is exactly what you'll see when you get an account</p>
                  <div className="transform scale-[0.85] md:scale-100 origin-top">
                    <DemoDashboard />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 - SMS */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold shrink-0">4</span>
                <h3 className="font-semibold text-lg">Customers get instant confirmations & reminders</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11">
                After every order or reservation, Aivia can automatically send SMS confirmations and reminders, so your customers know exactly when to arrive and you get fewer no-shows.
              </p>
              {/* SMS Preview */}
              <div className="bg-muted/50 rounded-xl p-4 ml-11">
                <div className="bg-background rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <MessageSquare className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-xs font-medium">The Italian Kitchen</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">Reservation confirmed ✅</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Name:</span> Sarah</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Party size:</span> 4 guests</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Table:</span> Window seating</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">When:</span> Fri 13 Dec at 7:00 PM</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Where:</span> 45 High Street</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Code:</span> ITK-4821</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-4 pb-2">
              <h4 className="text-lg font-semibold mb-4">Ready to see it in action?</h4>
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="group"
              >
                Get started with Aivia
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksDialog;
