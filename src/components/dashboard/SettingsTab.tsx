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

interface SettingsTabProps {
  businessId: string;
  business: any;
  activeSection?: string;
  onUpdate: () => void;
  currency?: string;
}

export const SettingsTab = ({ businessId, business, activeSection, onUpdate, currency = "GBP" }: SettingsTabProps) => {
  const mapSection = (section: string) => {
    if (["policies", "assistant", "localization", "ai", "accounts"].includes(section)) {
      return "business";
    }
    return section;
  };

  return (
    <Tabs defaultValue={mapSection(activeSection || "business")} className="space-y-6">
      <TabsList className="grid w-full grid-cols-6 lg:w-auto">
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="hours">Hours</TabsTrigger>
        <TabsTrigger value="timeoff">Time Off</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="services">
        <ServicesManagement businessId={businessId} onUpdate={onUpdate} currency={currency} />
      </TabsContent>

      <TabsContent value="staff" className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Staff Management</h3>
          <StaffInviteDialog businessId={businessId} businessName={business?.business_name || ""} />
        </div>
        <StaffJoinCodeSection businessId={businessId} businessName={business?.business_name || ""} />
        <StaffMembershipsManagement businessId={businessId} onUpdate={onUpdate} />
        <StaffManagement businessId={businessId} businessName={business?.business_name || ""} onUpdate={onUpdate} />
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
