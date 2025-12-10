import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, PhoneCall, MessageSquare, Calendar, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { SetupChecklist, type ChecklistItem } from "@/components/SetupChecklist";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { CallsTab } from "@/components/dashboard/CallsTab";
import { MessagesTab } from "@/components/dashboard/MessagesTab";
import { BookingsTab } from "@/components/dashboard/BookingsTab";
import { CalendarTab } from "@/components/dashboard/CalendarTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { AccountMenu } from "@/components/AccountMenu";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import { AiviaAssistantChat } from "@/components/AiviaAssistantChat";

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
  const {
    toast
  } = useToast();
  const {
    t
  } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSettingsSection, setActiveSettingsSection] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isStaffView, setIsStaffView] = useState(false);
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      // Check user roles
      const {
        data: roles
      } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isStaff = roles?.some(r => r.role === "staff");
      const isBusinessOwner = roles?.some(r => r.role === "business_owner");
      if (isStaff && !isBusinessOwner) {
        // Check staff membership status
        const {
          data: membership
        } = await supabase.from("staff_memberships").select("status, business_id").eq("user_id", user.id).maybeSingle();
        if (!membership) {
          navigate("/staff/invite");
          return;
        }
        if (membership.status === "pending_approval") {
          navigate("/staff/pending");
          return;
        }
        if (membership.status === "revoked") {
          navigate("/staff/pending");
          return;
        }

        // Staff with active status - load the business they belong to
        setUserRole("staff");
        setIsStaffView(true);
        await loadStaffBusinessData(membership.business_id);
      } else {
        setUserRole("business_owner");
        await loadBusinessData(user.id);
      }
      setLoading(false);
    };
    checkUser();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const loadStaffBusinessData = async (businessId: string) => {
    const {
      data: bizData
    } = await supabase.from("businesses").select("*").eq("id", businessId).single();
    if (bizData) {
      setBusiness(bizData as unknown as Business);
      const {
        data: settingsData
      } = await supabase.from("business_settings").select("*").eq("business_id", bizData.id).single();
      if (settingsData) {
        setSettings(settingsData);
      }
    }
  };
  const loadBusinessData = async (userId: string) => {
    const {
      data: bizData
    } = await supabase.from("businesses").select("*").eq("owner_id", userId).single();
    if (bizData) {
      setBusiness(bizData);

      // Load settings
      const {
        data: settingsData
      } = await supabase.from("business_settings").select("*").eq("business_id", bizData.id).single();
      if (settingsData) {
        setSettings(settingsData);
      }
      await loadSetupChecklist(bizData);
    }
  };
  const loadSetupChecklist = async (biz: Business) => {
    const [servicesRes, staffRes, hoursRes, settingsRes] = await Promise.all([supabase.from("services").select("id").eq("business_id", biz.id), supabase.from("staff").select("id").eq("business_id", biz.id), supabase.from("opening_hours").select("id").eq("business_id", biz.id), supabase.from("business_settings").select("*").eq("business_id", biz.id).single()]);
    const items: ChecklistItem[] = [{
      label: "Business info complete (name, address, phone)",
      isComplete: !!(biz.business_name && biz.address && biz.main_phone),
      action: "business"
    }, {
      label: "Services configured (at least one service)",
      isComplete: (servicesRes.data?.length || 0) > 0,
      action: "services"
    }, {
      label: "Staff added (at least one staff member)",
      isComplete: (staffRes.data?.length || 0) > 0,
      action: "staff"
    }, {
      label: "Opening hours set",
      isComplete: (hoursRes.data?.length || 0) > 0,
      action: "hours"
    }, {
      label: "Cancellation/refund policy set",
      isComplete: !!settingsRes.data?.cancellation_policy,
      action: "business"
    }, {
      label: "Booking rules configured",
      isComplete: !!(settingsRes.data?.min_booking_notice_hours && settingsRes.data?.max_days_advance),
      action: "business"
    }, {
      label: "Notification email configured",
      isComplete: !!settingsRes.data?.notification_email,
      action: "business"
    }, {
      label: "Assistant settings configured",
      isComplete: !!(settingsRes.data?.assistant_name && settingsRes.data?.primary_language && settingsRes.data?.tone),
      action: "business"
    }];
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
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>;
  }
  return <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 sm:h-12 w-auto object-fill" />
            <span className="text-sm sm:text-base font-mono font-extrabold hidden xs:inline">AIVIA</span>
          </div>
          <div className="flex items-center">
            {business && user && <AccountMenu businessName={business.business_name} userEmail={user.email || ""} planTier={business.plan_tier} aiviaActive={business.aivia_active} businessId={business.id} onAiviaToggle={active => setBusiness({
            ...business,
            aivia_active: active
          })} />}
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-4 md:container py-4 sm:py-8">
        {business?.status === "approved" && business && <>
            {!isStaffView && !isSetupComplete && <div className="mb-6">
                <SetupChecklist items={checklistItems} onItemClick={handleChecklistItemClick} />
              </div>}

            {isStaffView && <div className="mb-4 p-3 bg-primary/10 rounded-lg text-sm">
                You are viewing as staff for <strong>{business.business_name}</strong>
              </div>}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <TabsList className="h-auto p-1 bg-muted/50 rounded-lg flex gap-0.5 sm:gap-1 w-full sm:w-fit overflow-x-auto">
                <TabsTrigger value="dashboard" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("dashboard.title")}</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("dashboard.calendar")}</span>
                </TabsTrigger>
                {!isStaffView && <>
                    <TabsTrigger value="calls" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <PhoneCall className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.calls")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.messages")}</span>
                    </TabsTrigger>
                  </>}
                <TabsTrigger value="bookings" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("dashboard.bookings")}</span>
                </TabsTrigger>
                {!isStaffView && <TabsTrigger value="settings" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">{t("dashboard.settings")}</span>
                  </TabsTrigger>}
              </TabsList>

              <TabsContent value="dashboard">
                {business && settings && <DashboardTab businessName={business.business_name} currency={settings.currency || "GBP"} businessId={business.id} />}
              </TabsContent>

              <TabsContent value="calendar">
                <CalendarTab businessId={business.id} currency={settings?.currency || "GBP"} />
              </TabsContent>

              {!isStaffView && <>
                  <TabsContent value="calls">
                    <CallsTab businessId={business.id} />
                  </TabsContent>

                  <TabsContent value="messages">
                    <MessagesTab businessId={business.id} />
                  </TabsContent>
                </>}

              <TabsContent value="bookings">
                <BookingsTab businessId={business.id} />
              </TabsContent>

              {!isStaffView && <TabsContent value="settings">
                  <SettingsTab businessId={business.id} business={business} activeSection={activeSettingsSection} onUpdate={handleSettingsUpdate} currency={settings?.currency || "GBP"} />
                </TabsContent>}
            </Tabs>
          </>}

        {/* AI Assistant Chat */}
        {business && user && (
          <AiviaAssistantChat
            businessId={business.id}
            userId={user.id}
            role={isStaffView ? "staff" : "owner"}
          />
        )}
      </main>
    </div>;
};
export default Dashboard;