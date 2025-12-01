import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, LogOut, Plus, Settings, BarChart3, CheckCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Business {
  id: string;
  business_name: string;
  status: string;
  assigned_aivia_number: string | null;
  number_notes: string | null;
  porting_status: string | null;
  porting_instructions: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        // Load business info
        const { data: bizData } = await supabase
          .from("businesses")
          .select("id, business_name, status, assigned_aivia_number, number_notes, porting_status, porting_instructions")
          .eq("owner_id", user.id)
          .single();
        if (bizData) setBusiness(bizData);
      }
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent p-2 rounded-lg">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl">VoiceAgent Pro</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">
            Manage your AI voice agents and phone numbers
          </p>
        </div>

        {business?.status === "approved" && (business?.assigned_aivia_number || business?.porting_status) && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="space-y-2">
                {business.assigned_aivia_number && (
                  <div>
                    <p className="font-semibold">Your Aivia Number: {business.assigned_aivia_number}</p>
                    {business.number_notes && <p className="text-sm text-muted-foreground">{business.number_notes}</p>}
                  </div>
                )}
                {business.porting_status && (
                  <div>
                    <p className="font-semibold">Porting Status: <span className="capitalize">{business.porting_status.replace("_", " ")}</span></p>
                    {business.porting_instructions && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{business.porting_instructions}</p>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Phone className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No agents configured yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Calls this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Phone Numbers</CardTitle>
              <Settings className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Numbers assigned</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Set up your first AI voice agent in minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="bg-accent/10 p-2 rounded-lg">
                <Plus className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Create Your First Agent</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure an AI agent to handle calls for your business
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card opacity-60">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Get a Phone Number</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a number from our Twilio integration
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border bg-card opacity-60">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Configure Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Customize your agent's behavior and responses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
