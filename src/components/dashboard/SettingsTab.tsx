import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessInfoForm } from "./settings/BusinessInfoForm";
import { ServicesManagement } from "./settings/ServicesManagement";
import { StaffManagement } from "./settings/StaffManagement";
import { OpeningHoursForm } from "./settings/OpeningHoursForm";
import { PhoneNumberSection } from "./settings/PhoneNumberSection";
import { TimeOffManagement } from "./settings/TimeOffManagement";
import { StaffAccountsManagement } from "./settings/StaffAccountsManagement";

interface SettingsTabProps {
  businessId: string;
  business: any;
  activeSection?: string;
  onUpdate: () => void;
  currency?: string;
}

export const SettingsTab = ({ businessId, business, activeSection, onUpdate, currency = "GBP" }: SettingsTabProps) => {
  // Map old section names to new consolidated structure
  const mapSection = (section: string) => {
    if (["policies", "assistant", "localization", "ai"].includes(section)) {
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
        <TabsTrigger value="accounts">Staff Login</TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="services">
        <ServicesManagement businessId={businessId} onUpdate={onUpdate} currency={currency} />
      </TabsContent>

      <TabsContent value="staff">
        <StaffManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="hours">
        <OpeningHoursForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="timeoff">
        <TimeOffManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="accounts">
        <StaffAccountsManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>
    </Tabs>
  );
};
