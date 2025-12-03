import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import aiviaLogo from "@/assets/aivia-logo.png";
import { Phone, Calendar, MessageSquare, BarChart, CheckCircle2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <div className="flex items-center gap-1">
            <img src={aiviaLogo} alt="Aivia" className="h-14 w-auto" />
            <span className="text-2xl font-bold text-foreground">AIVIA</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth?mode=signin")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Your 24/7 AI Receptionist
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Never miss a booking again. AIVIA handles calls, schedules appointments, and manages your salon or barbershop — around the clock.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
            Start Free Trial
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-lg px-8">
            See How It Works
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 bg-muted/50">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need to grow</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center p-6 bg-background rounded-lg border border-border hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">24/7 Phone Coverage</h3>
            <p className="text-muted-foreground">Never miss a call, even after hours</p>
          </div>
          <div className="text-center p-6 bg-background rounded-lg border border-border hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-secondary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Scheduling</h3>
            <p className="text-muted-foreground">AI books appointments based on availability</p>
          </div>
          <div className="text-center p-6 bg-background rounded-lg border border-border hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Natural Conversations</h3>
            <p className="text-muted-foreground">Friendly, human-like interactions</p>
          </div>
          <div className="text-center p-6 bg-background rounded-lg border border-border hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BarChart className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Analytics Dashboard</h3>
            <p className="text-muted-foreground">Track calls, bookings, and revenue</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why service businesses love AIVIA</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Save Time & Money</h3>
                <p className="text-muted-foreground">No more hiring receptionists or missing calls during busy hours</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Increase Bookings</h3>
                <p className="text-muted-foreground">Capture every opportunity with instant, 24/7 booking availability</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Better Customer Experience</h3>
                <p className="text-muted-foreground">Provide professional service even when you're away</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Easy Setup</h3>
                <p className="text-muted-foreground">Get started in minutes, no technical knowledge required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your business?
          </h2>
          <p className="text-white/90 mb-8 text-lg max-w-2xl mx-auto">
            Join hundreds of salons and barbershops using AIVIA to grow their business
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/auth")} className="text-lg px-8">
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-4">© 2024 AIVIA. All rights reserved.</p>
          <Button 
            variant="link" 
            onClick={() => navigate("/staff/login")} 
            className="text-muted-foreground hover:text-foreground"
          >
            Staff login
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;