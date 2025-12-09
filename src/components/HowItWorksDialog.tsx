import { Settings, Phone, LayoutDashboard, MessageSquare, ArrowRight, Plus, Users, Zap, Calendar, TrendingUp, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

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
                Create your account, add your services, prices, staff, and opening hours. Choose your Aivia phone number (or connect your existing line), and pick the AI voice and greeting you want customers to hear.
              </p>
              <div className="flex flex-wrap gap-2 pl-11">
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <Plus className="w-3.5 h-3.5 text-accent" />
                  Add services
                </div>
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  Add staff
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
                When a customer calls your number, Aivia picks up instantly with your business name, speaks naturally, and asks how it can help. It understands what they say, checks your availability, and books, moves, or cancels appointments — just like a real receptionist.
              </p>
              {/* Conversation Example */}
              <div className="bg-muted/50 rounded-xl p-4 ml-11 space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] text-sm">
                    "Hey, I'd like a skin fade tomorrow around 3pm."
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] text-sm">
                    "No problem. We have Ahmed free at 3:15pm or Sam at 2:45pm. Which would you prefer?"
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] text-sm">
                    "Ahmed at 3:15."
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] text-sm">
                    "All set. I've booked you in with Ahmed tomorrow at 3:15pm. You'll get a confirmation text shortly."
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
                Every call, booking, and message appears in your Aivia dashboard. You can see today's appointments, who's coming in, which staff are busy, and simple analytics like how many calls Aivia answered and how many bookings were made.
              </p>
              {/* Mini Dashboard */}
              <div className="bg-muted/50 rounded-xl p-4 ml-11">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <PhoneCall className="w-4 h-4 text-accent mx-auto mb-1" />
                    <div className="text-base font-bold">47</div>
                    <div className="text-xs text-muted-foreground">Calls</div>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <Calendar className="w-4 h-4 text-accent mx-auto mb-1" />
                    <div className="text-base font-bold">32</div>
                    <div className="text-xs text-muted-foreground">Bookings</div>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <TrendingUp className="w-4 h-4 text-accent mx-auto mb-1" />
                    <div className="text-base font-bold">£640</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                </div>
                <div className="bg-background rounded-lg p-2.5">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Today's Bookings</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>10:00 - Jamal (Skin fade)</span><span className="text-accent">Ahmed</span></div>
                    <div className="flex justify-between"><span>11:30 - Marcus (Beard trim)</span><span className="text-accent">Sam</span></div>
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
                After every booking, Aivia can automatically send SMS confirmations and reminders, so your customers know exactly when they're booked — and you get fewer no-shows.
              </p>
              {/* SMS Preview */}
              <div className="bg-muted/50 rounded-xl p-4 ml-11">
                <div className="bg-background rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <MessageSquare className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-xs font-medium">Exclusive Cuts</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">Booking confirmed ✅</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Name:</span> Jamal</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Service:</span> Skin fade</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">With:</span> Ahmed</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">When:</span> Tue 10 Dec at 3:15 PM</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Where:</span> 123 High Street</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Code:</span> EXC-2647</p>
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
