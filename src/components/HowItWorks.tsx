import { Settings, Phone, LayoutDashboard, MessageSquare, ArrowRight, Plus, Users, Zap, Calendar, TrendingUp, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HowItWorks = () => {
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-background">
      <div className="container px-4 mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
            How Aivia Works for Your Business
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            From missed calls to fully-managed bookings in a few minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-16 md:space-y-24 max-w-5xl mx-auto">
          {/* Step 1 - Setup */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-wide mb-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold">1</span>
                Set up your business in minutes
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                Create your account, add your services, prices, staff, and opening hours. Choose your Aivia phone number (or connect your existing line), and pick the AI voice and greeting you want customers to hear.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                  <Plus className="w-4 h-4 text-accent" />
                  Add services
                </div>
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                  <Users className="w-4 h-4 text-accent" />
                  Add staff
                </div>
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm">
                  <Zap className="w-4 h-4 text-accent" />
                  Go live
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-semibold">Quick Setup</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-muted-foreground">Business details configured</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-muted-foreground">Services & pricing added</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-muted-foreground">Staff schedules set</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-muted-foreground">AI voice selected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 - Call Flow */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2">
              <div className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-wide mb-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold">2</span>
                Aivia answers every call, 24/7
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                When a customer calls your number, Aivia picks up instantly with your business name, speaks naturally, and asks how it can help. It understands what they say, checks your availability, and books, moves, or cancels appointments — just like a real receptionist.
              </p>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-semibold">Live Conversation</span>
                </div>
                <div className="space-y-4">
                  {/* Caller message */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] text-sm">
                      "Hey, I'd like a skin fade tomorrow around 3pm."
                    </div>
                  </div>
                  {/* Aivia response */}
                  <div className="flex justify-start">
                    <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] text-sm">
                      "No problem. We have Ahmed free at 3:15pm or Sam at 2:45pm. Which would you prefer?"
                    </div>
                  </div>
                  {/* Caller message */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] text-sm">
                      "Ahmed at 3:15."
                    </div>
                  </div>
                  {/* Aivia response */}
                  <div className="flex justify-start">
                    <div className="bg-accent/20 text-foreground rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] text-sm">
                      "All set. I've booked you in with Ahmed tomorrow at 3:15pm. You'll get a confirmation text shortly."
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 - Dashboard */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-wide mb-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold">3</span>
                You see everything in one dashboard
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Every call, booking, and message appears in your Aivia dashboard. You can see today's appointments, who's coming in, which staff are busy, and simple analytics like how many calls Aivia answered and how many bookings were made.
              </p>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-semibold">Your Dashboard</span>
                </div>
                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-background rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-accent mb-1">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold">47</div>
                    <div className="text-xs text-muted-foreground">Calls answered</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-accent mb-1">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold">32</div>
                    <div className="text-xs text-muted-foreground">Bookings</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-accent mb-1">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold">£640</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                </div>
                {/* Today's bookings */}
                <div className="bg-background rounded-xl p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Today's Bookings</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>10:00 - Jamal (Skin fade)</span>
                      <span className="text-accent">Ahmed</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>11:30 - Marcus (Beard trim)</span>
                      <span className="text-accent">Sam</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>14:00 - David (Haircut)</span>
                      <span className="text-accent">Ahmed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 - SMS */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2">
              <div className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-wide mb-3">
                <span className="w-8 h-8 rounded-full bg-accent text-primary flex items-center justify-center text-sm font-bold">4</span>
                Customers get instant confirmations & reminders
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed">
                After every booking, Aivia can automatically send SMS confirmations and reminders, so your customers know exactly when they're booked — and you get fewer no-shows.
              </p>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-semibold">SMS Confirmation</span>
                </div>
                {/* SMS Preview */}
                <div className="bg-background rounded-2xl p-4 border border-border/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-sm font-medium">Exclusive Cuts</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-foreground">Booking confirmed ✅</p>
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
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 md:mt-28 text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-foreground">
            Ready to see it in action?
          </h3>
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")} 
            className="text-lg px-8 group"
          >
            Get started with Aivia
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
