import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, LogOut, Plus, Settings, BarChart3, CheckCircle2, Lock } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { AiviaStatusCard } from "@/components/AiviaStatusCard";
import { SetupChecklist, type ChecklistItem } from "@/components/SetupChecklist";

interface Business {
  id: string;
  business_name: string;
  status: string;
  assigned_aivia_number: string | null;
  number_notes: string | null;
  porting_status: string | null;
  porting_instructions: string | null;
  aivia_active: boolean;
  plan_tier: string;
  address: string;
  main_phone: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

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
          .select("id, business_name, status, assigned_aivia_number, number_notes, porting_status, porting_instructions, aivia_active, plan_tier, address, main_phone")
          .eq("owner_id", user.id)
          .single();
        if (bizData) {
          setBusiness(bizData);
          await loadSetupChecklist(bizData.id);
        }
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

  const loadSetupChecklist = async (businessId: string) => {
    // Fetch all required data
    const [servicesRes, staffRes, hoursRes, settingsRes] = await Promise.all([
      supabase.from("services").select("id").eq("business_id", businessId),
      supabase.from("staff").select("id, working_hours").eq("business_id", businessId),
      supabase.from("opening_hours").select("id").eq("business_id", businessId),
      supabase.from("business_settings").select("*").eq("business_id", businessId).single(),
    ]);

    const items: ChecklistItem[] = [
      {
        label: "Business info complete (name, address, phone)",
        isComplete: !!(business?.business_name && business?.address && business?.main_phone),
      },
      {
        label: "Services configured (at least one service)",
        isComplete: (servicesRes.data?.length || 0) > 0,
      },
      {
        label: "Staff added (at least one staff member)",
        isComplete: (staffRes.data?.length || 0) > 0,
      },
      {
        label: "Opening hours set",
        isComplete: (hoursRes.data?.length || 0) > 0,
      },
      {
        label: "Cancellation/refund policy set",
        isComplete: !!settingsRes.data?.cancellation_policy,
      },
      {
        label: "Booking rules configured",
        isComplete: !!(settingsRes.data?.min_booking_notice_hours && settingsRes.data?.max_days_advance),
      },
      {
        label: "Notification email configured",
        isComplete: !!settingsRes.data?.notification_email,
      },
      {
        label: "Phone number assigned or porting in progress",
        isComplete: !!(business?.assigned_aivia_number || business?.porting_status),
      },
      {
        label: "Assistant settings configured",
        isComplete: !!(settingsRes.data?.assistant_name && settingsRes.data?.primary_language && settingsRes.data?.tone),
      },
    ];

    setChecklistItems(items);
  };

  const isSetupComplete = checklistItems.every(item => item.isComplete);

  const getTierName = (tier: string) => {
    switch (tier) {
      case "tier_1": return "Tier 1";
      case "tier_2": return "Tier 2";
      case "tier_3": return "Tier 3";
      default: return "Tier 1";
    }
  };

  const getTierFeatures = (tier: string) => {
    switch (tier) {
      case "tier_1":
        return {
          emailHandling: false,
          smsReminders: false,
          advancedAnalytics: false,
          multiBranch: false,
        };
      case "tier_2":
        return {
          emailHandling: true,
          smsReminders: true,
          advancedAnalytics: false,
          multiBranch: false,
        };
      case "tier_3":
        return {
          emailHandling: true,
          smsReminders: true,
          advancedAnalytics: true,
          multiBranch: true,
        };
      default:
        return {
          emailHandling: false,
          smsReminders: false,
          advancedAnalytics: false,
          multiBranch: false,
        };
    }
  };

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
              <p className="text-muted-foreground">
                Manage your AI voice agents and phone numbers
              </p>
            </div>
            {business && (
              <Badge variant="outline" className="text-sm">
                Current plan: {getTierName(business.plan_tier)}
              </Badge>
            )}
          </div>
        </div>

        {business?.status === "approved" && business && (
          <>
            <AiviaStatusCard
              businessId={business.id}
              isActive={business.aivia_active}
              isSetupComplete={isSetupComplete}
              onStatusChange={(newStatus) => setBusiness({ ...business, aivia_active: newStatus })}
            />

            <div className="mt-6">
              <SetupChecklist items={checklistItems} />
            </div>

            {(business.assigned_aivia_number || business.porting_status) && (
              <Alert className="mt-6 border-primary/50 bg-primary/5">
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
          </>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8 mt-8">
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

            {business && !getTierFeatures(business.plan_tier).emailHandling && (
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-card opacity-60">
                <div className="bg-muted p-2 rounded-lg">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Email Handling</h3>
                  <p className="text-sm text-muted-foreground">
                    Available on higher tiers
                  </p>
                </div>
              </div>
            )}

            {business && !getTierFeatures(business.plan_tier).smsReminders && (
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-card opacity-60">
                <div className="bg-muted p-2 rounded-lg">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">SMS Reminders</h3>
                  <p className="text-sm text-muted-foreground">
                    Available on higher tiers
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
