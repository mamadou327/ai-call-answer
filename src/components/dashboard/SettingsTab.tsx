import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessInfoForm } from "./settings/BusinessInfoForm";
import { ServicesManagement } from "./settings/ServicesManagement";
import { StaffManagement } from "./settings/StaffManagement";
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
import { ContactAdminForm } from "./settings/ContactAdminForm";
import { StripeConnectSettings } from "./settings/StripeConnectSettings";
import { DepositSettings } from "./settings/DepositSettings";
import { Building2, Bot, FileText, Scissors, Users, Clock, CalendarOff, UserCircle, Bell, HelpCircle } from "lucide-react";

interface SettingsTabProps {
  businessId: string;
  business: any;
  activeSection?: string;
  onUpdate: () => void;
  currency?: string;
}

export const SettingsTab = ({ businessId, business, activeSection, onUpdate, currency = "GBP" }: SettingsTabProps) => {
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
        <TabsTrigger value="services" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Scissors className="w-4 h-4" />
          <span className="hidden sm:inline">Services</span>
        </TabsTrigger>
        <TabsTrigger value="staff" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Staff</span>
        </TabsTrigger>
        <TabsTrigger value="hours" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Hours</span>
        </TabsTrigger>
        <TabsTrigger value="timeoff" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <CalendarOff className="w-4 h-4" />
          <span className="hidden sm:inline">Time Off</span>
        </TabsTrigger>
        <TabsTrigger value="customers" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <UserCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Customers</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="support" className="px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Support</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="ai">
        <AISettingsTab businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="policies" className="space-y-6">
        <PoliciesTab businessId={businessId} onUpdate={onUpdate} />
        <StripeConnectSettings business={business} onUpdate={onUpdate} />
        <DepositSettings businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="services">
        <ServicesManagement businessId={businessId} onUpdate={onUpdate} currency={currency} />
      </TabsContent>

      <TabsContent value="staff" className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Staff Management</h3>
          <StaffInviteDialog businessId={businessId} businessName={business?.business_name || ""} />
        </div>
        <StaffManagement businessId={businessId} businessName={business?.business_name || ""} onUpdate={onUpdate} />
        <StaffMembershipsManagement businessId={businessId} onUpdate={onUpdate} />
        <StaffJoinCodeSection businessId={businessId} businessName={business?.business_name || ""} />
      </TabsContent>

      <TabsContent value="hours">
        <OpeningHoursForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="timeoff">
        <TimeOffManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="customers">
        <CustomersManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <TwilioSettings business={business} onUpdate={onUpdate} />
        <EmailNotificationSettings business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="support">
        <ContactAdminForm businessId={businessId} />
      </TabsContent>
    </Tabs>
  );
};
