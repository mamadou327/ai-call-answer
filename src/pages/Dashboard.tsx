import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, LogOut, LayoutDashboard, PhoneCall, MessageSquare, Calendar, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { SetupChecklist, type ChecklistItem } from "@/components/SetupChecklist";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { CallsTab } from "@/components/dashboard/CallsTab";
import { MessagesTab } from "@/components/dashboard/MessagesTab";
import { BookingsTab } from "@/components/dashboard/BookingsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";

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
  secondary_phone: string | null;
  website: string | null;
  owner_id: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSettingsSection, setActiveSettingsSection] = useState<string>("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        await loadBusinessData(user.id);
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

  const loadBusinessData = async (userId: string) => {
    const { data: bizData } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", userId)
      .single();
    
    if (bizData) {
      setBusiness(bizData);
      
      // Load settings
      const { data: settingsData } = await supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", bizData.id)
        .single();
      
      if (settingsData) {
        setSettings(settingsData);
      }
      
      await loadSetupChecklist(bizData);
    }
  };

  const loadSetupChecklist = async (biz: Business) => {
    const [servicesRes, staffRes, hoursRes, settingsRes, currencyRes] = await Promise.all([
      supabase.from("services").select("id").eq("business_id", biz.id),
      supabase.from("staff").select("id").eq("business_id", biz.id),
      supabase.from("opening_hours").select("id").eq("business_id", biz.id),
      supabase.from("business_settings").select("*").eq("business_id", biz.id).single(),
      supabase.from("business_settings").select("currency").eq("business_id", biz.id).single(),
    ]);

    const items: ChecklistItem[] = [
      {
        label: "Business info complete (name, address, phone)",
        isComplete: !!(biz.business_name && biz.address && biz.main_phone),
        action: "business",
      },
      {
        label: "Services configured (at least one service)",
        isComplete: (servicesRes.data?.length || 0) > 0,
        action: "services",
      },
      {
        label: "Staff added (at least one staff member)",
        isComplete: (staffRes.data?.length || 0) > 0,
        action: "staff",
      },
      {
        label: "Opening hours set",
        isComplete: (hoursRes.data?.length || 0) > 0,
        action: "hours",
      },
      {
        label: "Cancellation/refund policy set",
        isComplete: !!settingsRes.data?.cancellation_policy,
        action: "policies",
      },
      {
        label: "Booking rules configured",
        isComplete: !!(settingsRes.data?.min_booking_notice_hours && settingsRes.data?.max_days_advance),
        action: "policies",
      },
      {
        label: "Notification email configured",
        isComplete: !!settingsRes.data?.notification_email,
        action: "policies",
      },
      {
        label: "Phone number assigned or porting in progress",
        isComplete: !!(biz.assigned_aivia_number || biz.porting_status),
        action: "phone",
      },
      {
        label: "Assistant settings configured",
        isComplete: !!(settingsRes.data?.assistant_name && settingsRes.data?.primary_language && settingsRes.data?.tone),
        action: "assistant",
      },
    ];

    setChecklistItems(items);
  };

  const handleChecklistItemClick = (action: string) => {
    setActiveSettingsSection(action);
    setActiveTab("settings");
  };

  const handleSettingsUpdate = async () => {
    if (business) {
      await loadBusinessData(business.owner_id);
    }
  };

  const isSetupComplete = checklistItems.every(item => item.isComplete);

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
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent p-2 rounded-lg">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl">Aivia</span>
          </div>
          <div className="flex items-center gap-4">
            {business && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg border">
                <span className="text-sm font-medium">AIV</span>
                <Button
                  variant={business.aivia_active ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
                    const newStatus = !business.aivia_active;
                    await supabase
                      .from("businesses")
                      .update({ aivia_active: newStatus })
                      .eq("id", business.id);
                    setBusiness({ ...business, aivia_active: newStatus });
                    toast({
                      title: newStatus ? "AIV Activated" : "AIV Deactivated",
                      description: newStatus ? "AI assistant is now active" : "AI assistant is now inactive",
                    });
                  }}
                >
                  {business.aivia_active ? "ON" : "OFF"}
                </Button>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {business?.status === "approved" && business && (
          <>
            {!isSetupComplete && (
              <div className="mb-6">
                <SetupChecklist items={checklistItems} onItemClick={handleChecklistItemClick} />
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="calls" className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4" />
                  Calls
                </TabsTrigger>
                <TabsTrigger value="messages" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Messages
                </TabsTrigger>
                <TabsTrigger value="bookings" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Bookings
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                {business && settings && (
                  <DashboardTab 
                    businessName={business.business_name} 
                    currency={settings.currency || "GBP"} 
                  />
                )}
              </TabsContent>

              <TabsContent value="calls">
                <CallsTab />
              </TabsContent>

              <TabsContent value="messages">
                <MessagesTab />
              </TabsContent>

              <TabsContent value="bookings">
                <BookingsTab businessId={business.id} />
              </TabsContent>

              <TabsContent value="settings">
                <SettingsTab
                  businessId={business.id}
                  business={business}
                  activeSection={activeSettingsSection}
                  onUpdate={handleSettingsUpdate}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;