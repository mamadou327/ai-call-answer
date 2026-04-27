import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, PhoneCall, MessageSquare, Calendar, Settings, Package, CalendarDays, Menu, PhoneMissed, ExternalLink } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { SetupChecklist, type ChecklistItem } from "@/components/SetupChecklist";
import { SalonDashboardTab } from "@/components/dashboard/SalonDashboardTab";
import { RestaurantDashboardTab } from "@/components/dashboard/RestaurantDashboardTab";
import { CallsTab } from "@/components/dashboard/CallsTab";
import { MessagesTab } from "@/components/dashboard/MessagesTab";
import { BookingsTab } from "@/components/dashboard/BookingsTab";
import { CalendarTab } from "@/components/dashboard/CalendarTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { OrdersTab } from "@/components/dashboard/OrdersTab";
import { ReservationsTab } from "@/components/dashboard/ReservationsTab";
import { FallbackReservationsTab } from "@/components/dashboard/FallbackReservationsTab";
import { MissedCallsTab } from "@/components/dashboard/MissedCallsTab";
import { AccountMenu } from "@/components/AccountMenu";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import { AiviaAssistantChat } from "@/components/AiviaAssistantChat";
import { Badge } from "@/components/ui/badge";
import { isDemoAccount, DEMO_BUSINESS, DEMO_SETTINGS } from "@/lib/demoData";
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
  business_type: string | null;
  average_prep_time_minutes?: number | null;
  reservation_platform?: string | null;
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  
  // Track unread messages count
  useEffect(() => {
    if (!business?.id) return;
    
    const loadUnreadCount = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_read", false)
        .eq("is_archived", false);
      
      setUnreadMessagesCount(count || 0);
    };
    
    loadUnreadCount();
    
    // Subscribe to messages changes
    const channel = supabase
      .channel('dashboard-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `business_id=eq.${business.id}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id]);

  // Background polling for unpaid deposit checks every 15 seconds
  useEffect(() => {
    if (!business?.id) return;
    const checkUnpaidDeposits = async () => {
      try {
        await supabase.functions.invoke('check-unpaid-deposits');
      } catch (error) {
        console.error('Background deposit check failed:', error);
      }
    };

    // Initial check
    checkUnpaidDeposits();

    // Poll every 15 seconds
    const intervalId = setInterval(checkUnpaidDeposits, 15000);
    return () => clearInterval(intervalId);
  }, [business?.id]);
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

      // Check if this is a demo account
      if (isDemoAccount(user.email)) {
        setIsDemoMode(true);
        setUserRole("business_owner");
        
        // Get the demo business type based on email
        const demoType = user.email?.includes("salon") ? "salon" 
          : user.email?.includes("pickup") ? "restaurant_pickup"
          : user.email?.includes("dinein") ? "restaurant_dine_in"
          : user.email?.includes("hybrid") ? "restaurant_hybrid"
          : "salon";
        
        const demoBiz = DEMO_BUSINESS[demoType as keyof typeof DEMO_BUSINESS] || DEMO_BUSINESS.salon;
        setBusiness(demoBiz as unknown as Business);
        setSettings(DEMO_SETTINGS);
        setChecklistItems([]);
        setLoading(false);
        return;
      }

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
  const loadSetupChecklist = async (biz: any) => {
    const businessType = biz.business_type || "salon";
    const isRestaurant = businessType.startsWith("restaurant");
    const hasTables = businessType === "restaurant_dine_in" || businessType === "restaurant_hybrid";

    // Fetch supporting data in parallel
    const [servicesRes, hoursRes, tablesRes, customerSettingsRes, numberSelRes] = await Promise.all([
      supabase.from("services").select("id").eq("business_id", biz.id),
      supabase.from("opening_hours").select("id").eq("business_id", biz.id),
      supabase.from("restaurant_tables").select("id").eq("business_id", biz.id),
      supabase.from("customer_settings").select("id").eq("business_id", biz.id).maybeSingle(),
      supabase.from("business_number_selection").select("id").eq("business_id", biz.id).maybeSingle(),
    ]);

    const phoneConfigured = !!(
      biz.assigned_aivia_number ||
      biz.twilio_phone_number ||
      numberSelRes.data
    );

    const items: ChecklistItem[] = [
      // Common items
      {
        label: "Business address",
        isComplete: !!(biz.address && biz.address.trim().length > 0),
        action: "business",
      },
      {
        label: "Website (optional)",
        isComplete: !!(biz.website && biz.website.trim().length > 0),
        action: "business",
      },
      {
        label: "Opening hours",
        isComplete: (hoursRes.data?.length || 0) > 0,
        action: "hours",
      },
      {
        label: "Phone number setup",
        isComplete: phoneConfigured,
        action: "business",
      },
    ];

    if (isRestaurant) {
      items.push(
        {
          label: "Cuisine type",
          isComplete: !!(biz.cuisine_type && biz.cuisine_type.trim().length > 0),
          action: "business",
        },
        {
          label: "Menu link",
          isComplete: !!(biz.menu_link && biz.menu_link.trim().length > 0),
          action: "business",
        },
        {
          label: "Average prep time",
          isComplete: biz.average_prep_time_minutes != null && biz.average_prep_time_minutes > 0,
          action: "orders",
        },
      );
      if (hasTables) {
        items.push({
          label: "Table count",
          isComplete: (tablesRes.data?.length || 0) > 0,
          action: "tables",
        });
      }
      items.push({
        label: "Payment methods accepted",
        isComplete: Array.isArray(biz.payment_methods) && biz.payment_methods.length > 0,
        action: "payments",
      });
    } else {
      // Salon
      items.push(
        {
          label: "Services offered",
          isComplete: (servicesRes.data?.length || 0) > 0,
          action: "services",
        },
        {
          label: "Staff count",
          isComplete: (biz.staff_count || 0) > 1,
          action: "staff",
        },
        {
          label: "Booking preferences",
          isComplete: !!customerSettingsRes.data,
          action: "policies",
        },
      );
    }

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
  // Per-business dismissal persistence
  useEffect(() => {
    if (!business?.id) return;
    setChecklistDismissed(
      localStorage.getItem(`aivia_setup_checklist_dismissed_${business.id}`) === "1"
    );
  }, [business?.id]);
  const handleDismissChecklist = () => {
    if (!business?.id) return;
    localStorage.setItem(`aivia_setup_checklist_dismissed_${business.id}`, "1");
    setChecklistDismissed(true);
  };
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
            <img alt="Aivia" className="h-8 sm:h-12 w-auto object-fill" src="/lovable-uploads/46fe3693-5209-4fc3-ae63-c34586186b41.png" />
            <span className="text-sm sm:text-base font-mono font-extrabold hidden xs:inline">AIVIA</span>
          </div>
          <div className="flex items-center">
            {business && user && <AccountMenu businessName={business.business_name} userEmail={user.email || ""} planTier={business.plan_tier} aiviaActive={business.aivia_active} businessId={business.id} onAiviaToggle={active => !isDemoMode && setBusiness({
            ...business,
            aivia_active: active
          })} />}
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-4 md:container py-4 sm:py-8">
        {business?.status === "approved" && business && <>
            {!isStaffView && !isSetupComplete && !checklistDismissed && <div className="mb-6">
                <SetupChecklist items={checklistItems} onItemClick={handleChecklistItemClick} onDismiss={handleDismissChecklist} />
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

                {/* Salon: Calendar & Bookings */}
                {business.business_type === "salon" && (
                  <>
                    <TabsTrigger value="calendar" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.calendar")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="bookings" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.bookings")}</span>
                    </TabsTrigger>
                  </>
                )}

                {/* Pickup Restaurant: Orders */}
                {business.business_type === "restaurant_pickup" && (
                  <TabsTrigger value="orders" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                    <Package className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">Orders</span>
                  </TabsTrigger>
                )}

                {/* Dine-in Restaurant: Reservations */}
                {business.business_type === "restaurant_dine_in" && (
                  <TabsTrigger value="reservations" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">Reservations</span>
                  </TabsTrigger>
                )}

                {/* Hybrid Restaurant: Orders & Reservations */}
                {business.business_type === "restaurant_hybrid" && (
                  <>
                    <TabsTrigger value="orders" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <Package className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">Orders</span>
                    </TabsTrigger>
                    <TabsTrigger value="reservations" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">Reservations</span>
                    </TabsTrigger>
                  </>
                )}
                {/* Fallback reservations tab hidden from clients for now */}
                {false && business.reservation_platform && business.reservation_platform !== "none" && (
                  <TabsTrigger value="fallback-reservations" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">Forwarded</span>
                  </TabsTrigger>
                )}

                {/* Calls tab for all business types (restaurants included) */}
                {!isStaffView && <>
                    <TabsTrigger value="calls" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <PhoneCall className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.calls")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0 relative">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">{t("dashboard.messages")}</span>
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="missed-calls" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                      <PhoneMissed className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate">Missed</span>
                    </TabsTrigger>
                  </>}
                {!isStaffView && <TabsTrigger value="settings" className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex-1 sm:flex-initial min-w-0">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">{t("dashboard.settings")}</span>
                  </TabsTrigger>}
              </TabsList>

              <TabsContent value="dashboard">
                {business && settings && (
                  ["restaurant_pickup", "restaurant_dine_in", "restaurant_hybrid"].includes(business.business_type || "") ? (
                    <RestaurantDashboardTab 
                      businessName={business.business_name} 
                      currency={settings.currency || "GBP"} 
                      businessId={business.id} 
                      businessType={business.business_type || ""}
                      averagePrepTime={business.average_prep_time_minutes || 20}
                      isDemoMode={isDemoMode}
                    />
                  ) : (
                    <SalonDashboardTab 
                      businessName={business.business_name} 
                      currency={settings.currency || "GBP"} 
                      businessId={business.id}
                      isDemoMode={isDemoMode}
                    />
                  )
                )}
              </TabsContent>

              {/* Salon tabs */}
              {business.business_type === "salon" && (
                <>
                  <TabsContent value="calendar">
                    <CalendarTab businessId={business.id} currency={settings?.currency || "GBP"} />
                  </TabsContent>
                  <TabsContent value="bookings">
                    <BookingsTab businessId={business.id} isDemoMode={isDemoMode} />
                  </TabsContent>
                </>
              )}

              {/* Orders tab for pickup and hybrid restaurants */}
              {(business.business_type === "restaurant_pickup" || business.business_type === "restaurant_hybrid") && (
                <TabsContent value="orders">
                  <OrdersTab businessId={business.id} currency={settings?.currency || "GBP"} averagePrepTime={business.average_prep_time_minutes || 20} isDemoMode={isDemoMode} />
                </TabsContent>
              )}

              {/* Reservations tab for dine-in and hybrid restaurants */}
              {(business.business_type === "restaurant_dine_in" || business.business_type === "restaurant_hybrid") && (
                <TabsContent value="reservations">
                  <ReservationsTab businessId={business.id} isDemoMode={isDemoMode} />
                </TabsContent>
              )}

              {!isStaffView && <>
                  <TabsContent value="calls">
                    <CallsTab businessId={business.id} isDemoMode={isDemoMode} businessType={business.business_type} />
                  </TabsContent>

                  <TabsContent value="messages">
                    <MessagesTab businessId={business.id} isDemoMode={isDemoMode} businessType={business.business_type} />
                  </TabsContent>

                  <TabsContent value="missed-calls">
                    <MissedCallsTab businessId={business.id} />
                  </TabsContent>
                </>}

              {/* Fallback reservations for restaurants using external platforms */}
              {business.reservation_platform && business.reservation_platform !== "none" && (
                <TabsContent value="fallback-reservations">
                  <FallbackReservationsTab businessId={business.id} reservationPlatform={business.reservation_platform} />
                </TabsContent>
              )}

              {!isStaffView && <TabsContent value="settings">
                  <SettingsTab businessId={business.id} business={business} activeSection={activeSettingsSection} onUpdate={handleSettingsUpdate} currency={settings?.currency || "GBP"} />
                </TabsContent>}
            </Tabs>
          </>}

        {/* AI Assistant Chat */}
        {business && user && <AiviaAssistantChat businessId={business.id} userId={user.id} role={isStaffView ? "staff" : "owner"} />}
      </main>
    </div>;
};
export default Dashboard;