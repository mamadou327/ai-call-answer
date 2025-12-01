import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, LogOut, LayoutDashboard, PhoneCall, MessageSquare, Calendar, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { AiviaStatusCard } from "@/components/AiviaStatusCard";
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
      await loadSetupChecklist(bizData);
    }
  };

  const loadSetupChecklist = async (biz: Business) => {
    const [servicesRes, staffRes, hoursRes, settingsRes] = await Promise.all([
      supabase.from("services").select("id").eq("business_id", biz.id),
      supabase.from("staff").select("id").eq("business_id", biz.id),
      supabase.from("opening_hours").select("id").eq("business_id", biz.id),
      supabase.from("business_settings").select("*").eq("business_id", biz.id).single(),
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
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container py-8">
        {business?.status === "approved" && business && (
          <>
            <div className="mb-6">
              <AiviaStatusCard
                businessId={business.id}
                isActive={business.aivia_active}
                isSetupComplete={isSetupComplete}
                onStatusChange={(newStatus) => setBusiness({ ...business, aivia_active: newStatus })}
              />
            </div>

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
                <DashboardTab businessName={business.business_name} />
              </TabsContent>

              <TabsContent value="calls">
                <CallsTab />
              </TabsContent>

              <TabsContent value="messages">
                <MessagesTab />
              </TabsContent>

              <TabsContent value="bookings">
                <BookingsTab />
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