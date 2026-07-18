import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessInfoForm } from "./settings/BusinessInfoForm";
import { ServicesManagement } from "./settings/ServicesManagement";
import { StaffManagement } from "./settings/StaffManagement";
import { StaffTasksManagement } from "./settings/StaffTasksManagement";
import { OpeningHoursForm } from "./settings/OpeningHoursForm";
import { TimeOffManagement } from "./settings/TimeOffManagement";
import { StaffJoinCodeSection } from "./settings/StaffJoinCodeSection";
import { StaffMembershipsManagement } from "./settings/StaffMembershipsManagement";
import { StaffInviteDialog } from "./settings/StaffInviteDialog";
import { CustomersManagement } from "./settings/CustomersManagement";
import { AISettingsTab } from "./settings/AISettingsTab";
import { PoliciesTab } from "./settings/PoliciesTab";
import { EmailNotificationSettings } from "./settings/EmailNotificationSettings";
import { TwilioSettings } from "./settings/TwilioSettings";
import { DepositSettings } from "./settings/DepositSettings";
import { OnlineBookingSettings } from "./settings/OnlineBookingSettings";
import { PaymentProvidersSettings } from "./settings/PaymentProvidersSettings";
import { MenuManagement } from "./settings/MenuManagement";
import { BillingSettings } from "./settings/BillingSettings";
import { AccountManagementSection } from "./settings/AccountManagementSection";
import { CustomerDataRequestSection } from "./settings/CustomerDataRequestSection";
import { LockedFeatureCard } from "./LockedFeatureCard";
import { useTier } from "@/hooks/use-tier";
import { tierMeets } from "@/lib/tiers";
import { Building2, Bot, FileText, Scissors, Users, Clock, CalendarOff, UserCircle, Bell, Globe, CreditCard, UtensilsCrossed, Armchair, Crown, PhoneForwarded } from "lucide-react";

interface SettingsTabProps {
  businessId: string;
  business: any;
  activeSection?: string;
  onUpdate: () => void;
  currency?: string;
}

export const SettingsTab = ({ businessId, business, activeSection, onUpdate, currency = "GBP" }: SettingsTabProps) => {
  const businessType = business?.business_type || "salon";
  const isRestaurant = businessType?.startsWith("restaurant");
  const { tier } = useTier(businessId);
  const canCollectDeposits = tierMeets(tier, "growth");
  const isPickup = businessType === "restaurant_pickup" || businessType === "restaurant_hybrid";
  const isDineIn = businessType === "restaurant_dine_in" || businessType === "restaurant_hybrid";

  const mapSection = (section: string) => {
    if (["localization", "accounts"].includes(section)) {
      return "business";
    }
    if (["assistant"].includes(section)) {
      return "ai";
    }
    if (["policies"].includes(section)) {
      return "policies";
    }
    if (["sms", "email"].includes(section)) {
      return "notifications";
    }
    if (["stripe", "payments"].includes(section)) {
      return "payments";
    }
    // Map restaurant-specific sections
    if (section === "menu") return "menu";
    if (section === "tables") return "tables";
    if (section === "orders") return "orders";
    return section;
  };

  return (
    <Tabs defaultValue={mapSection(activeSection || "business")} className="space-y-6">
      <TabsList className="h-auto p-1 bg-muted/50 rounded-lg flex flex-wrap gap-1 w-fit">
        <TabsTrigger value="business" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">Business</span>
        </TabsTrigger>
        <TabsTrigger value="ai" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">AI</span>
        </TabsTrigger>
        <TabsTrigger value="policies" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Policies</span>
        </TabsTrigger>
        
        {/* Salon-specific tabs */}
        {!isRestaurant && (
          <TabsTrigger value="services" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <Scissors className="w-4 h-4" />
            <span className="hidden sm:inline">Services</span>
          </TabsTrigger>
        )}
        
        {/* Staff tab - available for all business types */}
        <TabsTrigger value="staff" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Staff</span>
        </TabsTrigger>
        
        {/* Restaurant-specific tabs */}
        {isPickup && (
          <TabsTrigger value="menu" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
          </TabsTrigger>
        )}
        {isDineIn && (
          <TabsTrigger value="tables" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <Armchair className="w-4 h-4" />
            <span className="hidden sm:inline">Tables</span>
          </TabsTrigger>
        )}
        
        <TabsTrigger value="hours" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Hours</span>
        </TabsTrigger>
        
        {/* Time Off only for salon */}
        {!isRestaurant && (
          <TabsTrigger value="timeoff" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <CalendarOff className="w-4 h-4" />
            <span className="hidden sm:inline">Time Off</span>
          </TabsTrigger>
        )}
        
        <TabsTrigger value="booking" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{isRestaurant ? "Ordering" : "Booking"}</span>
        </TabsTrigger>
        <TabsTrigger value="customers" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <UserCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Customers</span>
        </TabsTrigger>
        <TabsTrigger value="payments" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" />
          <span className="hidden sm:inline">Payments</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="billing" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Crown className="w-4 h-4" />
          <span className="hidden sm:inline">Billing</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="business" className="space-y-6">
        <a
          href="/help/call-forwarding"
          className="block rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <PhoneForwarded className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Setup Guide: Forward your calls to Aivia</p>
                <p className="text-xs text-muted-foreground">Get started in about 2 minutes — step-by-step instructions.</p>
              </div>
            </div>
            <span className="text-sm text-primary font-medium shrink-0">Open →</span>
          </div>
        </a>
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="ai">
        <AISettingsTab businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="policies" className="space-y-6">
        <PoliciesTab businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="payments" className="space-y-6">
        <PaymentProvidersSettings business={business} onUpdate={onUpdate} currency={currency} />
        {canCollectDeposits ? (
          <DepositSettings businessId={businessId} onUpdate={onUpdate} />
        ) : (
          <LockedFeatureCard
            featureName="Deposit Collection"
            description="Take deposits at booking via Stripe to reduce no-shows."
            requiredTier="growth"
            businessId={businessId}
            businessName={business?.business_name}
          />
        )}
      </TabsContent>

      {/* Salon-specific content */}
      {!isRestaurant && (
        <>
          <TabsContent value="services">
            <ServicesManagement businessId={businessId} onUpdate={onUpdate} currency={currency} />
          </TabsContent>

          <TabsContent value="timeoff">
            <TimeOffManagement businessId={businessId} onUpdate={onUpdate} />
          </TabsContent>
        </>
      )}

      {/* Staff tab - available for all business types */}
      <TabsContent value="staff" className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Staff Management</h3>
          <StaffInviteDialog businessId={businessId} businessName={business?.business_name || ""} />
        </div>
        <StaffManagement businessId={businessId} businessName={business?.business_name || ""} onUpdate={onUpdate} />
        <StaffTasksManagement businessId={businessId} onUpdate={onUpdate} />
        <StaffMembershipsManagement businessId={businessId} onUpdate={onUpdate} />
        <StaffJoinCodeSection businessId={businessId} businessName={business?.business_name || ""} />
      </TabsContent>

      {/* Restaurant-specific content */}
      {isPickup && (
        <TabsContent value="menu">
          <MenuManagement businessId={businessId} onUpdate={onUpdate} currency={currency} />
        </TabsContent>
      )}
      
      {isDineIn && (
        <TabsContent value="tables">
          <div className="text-center py-12 text-muted-foreground">
            <Armchair className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Table Management</h3>
            <p>Coming soon - manage your restaurant tables here</p>
          </div>
        </TabsContent>
      )}

      <TabsContent value="hours">
        <OpeningHoursForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="booking">
        <OnlineBookingSettings businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="customers">
        <CustomersManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <TwilioSettings business={business} onUpdate={onUpdate} />
        <EmailNotificationSettings business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="billing" className="space-y-6">
        <BillingSettings businessId={businessId} businessName={business?.business_name} />
        <AccountManagementSection />
        <CustomerDataRequestSection />
      </TabsContent>
    </Tabs>
  );
};
