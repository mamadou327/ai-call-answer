import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessInfoForm } from "./settings/BusinessInfoForm";
import { ServicesManagement } from "./settings/ServicesManagement";
import { StaffManagement } from "./settings/StaffManagement";
import { OpeningHoursForm } from "./settings/OpeningHoursForm";
import { PhoneNumberSection } from "./settings/PhoneNumberSection";
import { PoliciesForm } from "./settings/PoliciesForm";
import { AssistantSettings } from "./settings/AssistantSettings";

interface SettingsTabProps {
  businessId: string;
  business: any;
  activeSection?: string;
  onUpdate: () => void;
}

export const SettingsTab = ({ businessId, business, activeSection, onUpdate }: SettingsTabProps) => {
  return (
    <Tabs defaultValue={activeSection || "business"} className="space-y-6">
      <TabsList className="grid w-full grid-cols-7 lg:w-auto">
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="hours">Hours</TabsTrigger>
        <TabsTrigger value="phone">Phone</TabsTrigger>
        <TabsTrigger value="policies">Policies</TabsTrigger>
        <TabsTrigger value="assistant">Assistant</TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <BusinessInfoForm businessId={businessId} business={business} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="services">
        <ServicesManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="staff">
        <StaffManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="hours">
        <OpeningHoursForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="phone">
        <PhoneNumberSection business={business} />
      </TabsContent>

      <TabsContent value="policies">
        <PoliciesForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="assistant">
        <AssistantSettings businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>
    </Tabs>
  );
};