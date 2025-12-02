import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessInfoForm } from "./settings/BusinessInfoForm";
import { ServicesManagement } from "./settings/ServicesManagement";
import { StaffManagement } from "./settings/StaffManagement";
import { OpeningHoursForm } from "./settings/OpeningHoursForm";
import { PhoneNumberSection } from "./settings/PhoneNumberSection";
import { PoliciesForm } from "./settings/PoliciesForm";
import { AssistantSettings } from "./settings/AssistantSettings";
import { LocalizationSettings } from "./settings/LocalizationSettings";
import { WebsiteAnalysis } from "./settings/WebsiteAnalysis";
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
  const handleWebsiteAnalysis = (analysis: any) => {
    // Analysis data is ready - user can review in each section
    // The data will be shown with missing fields highlighted in red
    console.log("Website analysis completed:", analysis);
  };

  return (
    <Tabs defaultValue={activeSection || "business"} className="space-y-6">
      <TabsList className="grid w-full grid-cols-11 lg:w-auto">
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="hours">Hours</TabsTrigger>
        <TabsTrigger value="phone">Phone</TabsTrigger>
        <TabsTrigger value="policies">Policies</TabsTrigger>
        <TabsTrigger value="assistant">Assistant</TabsTrigger>
        <TabsTrigger value="localization">Location</TabsTrigger>
        <TabsTrigger value="timeoff">Time Off</TabsTrigger>
        <TabsTrigger value="accounts">Staff Login</TabsTrigger>
        <TabsTrigger value="ai">AI Analysis</TabsTrigger>
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

      <TabsContent value="phone">
        <PhoneNumberSection business={business} />
      </TabsContent>

      <TabsContent value="policies">
        <PoliciesForm businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="assistant">
        <AssistantSettings businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="localization">
        <LocalizationSettings businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="timeoff">
        <TimeOffManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="accounts">
        <StaffAccountsManagement businessId={businessId} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="ai">
        <WebsiteAnalysis 
          businessId={businessId} 
          currentWebsite={business.website || ""}
          onAnalysisComplete={handleWebsiteAnalysis}
        />
      </TabsContent>
    </Tabs>
  );
};