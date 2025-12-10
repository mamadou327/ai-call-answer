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
    return section;
  };

  return (
    <Tabs defaultValue={mapSection(activeSection || "business")} className="space-y-6">
      <TabsList className="h-auto p-1 bg-muted/50 rounded-lg flex flex-wrap gap-1 w-fit">
        <TabsTrigger value="business" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Business</TabsTrigger>
        <TabsTrigger value="ai" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">AI</TabsTrigger>
        <TabsTrigger value="policies" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Policies</TabsTrigger>
        <TabsTrigger value="services" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Services</TabsTrigger>
        <TabsTrigger value="staff" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Staff</TabsTrigger>
        <TabsTrigger value="hours" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Hours</TabsTrigger>
        <TabsTrigger value="timeoff" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Time Off</TabsTrigger>
        <TabsTrigger value="customers" className="px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">Customers</TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="ai">
        <AISettingsTab businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="policies">
        <PoliciesTab businessId={businessId} onUpdate={onUpdate} />
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
    </Tabs>
  );
};
