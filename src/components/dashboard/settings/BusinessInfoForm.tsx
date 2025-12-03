import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { WebsiteAnalysis } from "./WebsiteAnalysis";
import { PolicyUpload } from "./PolicyUpload";
import { TwilioSettings } from "./TwilioSettings";
import { Sparkles, MapPin, Phone, Bot, FileText } from "lucide-react";

interface BusinessInfoFormProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

const languageMap: Record<string, string> = {
  "English": "en",
  "Spanish": "es",
  "French": "fr",
  "German": "de"
};

export const BusinessInfoForm = ({ businessId, business, onUpdate }: BusinessInfoFormProps) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  // Business info
  const [formData, setFormData] = useState({
    business_name: business?.business_name || "",
    address: business?.address || "",
    main_phone: business?.main_phone || "",
    secondary_phone: business?.secondary_phone || "",
    website: business?.website || "",
  });

  // Settings data (assistant, localization, policies)
  const [settingsData, setSettingsData] = useState({
    // Localization
    country: "United Kingdom",
    currency: "GBP",
    app_language: "English",
    // Assistant
    assistant_name: "Aivia",
    primary_language: "English",
    tone: "neutral" as "casual" | "neutral" | "formal",
    voice_gender: "female" as "male" | "female" | "neutral",
    voice_speed: "normal" as "slow" | "normal" | "fast",
    // Policies
    cancellation_policy: "",
    min_booking_notice_hours: 2,
    max_days_advance: 30,
    min_cancellation_notice_hours: 24,
    notification_email: "",
  });

  useEffect(() => {
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("business_settings")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (data) {
      setSettingsData({
        country: data.country || "United Kingdom",
        currency: data.currency || "GBP",
        app_language: data.app_language || "English",
        assistant_name: data.assistant_name || "Aivia",
        primary_language: data.primary_language || "English",
        tone: (data.tone || "neutral") as "casual" | "neutral" | "formal",
        voice_gender: (data.voice_gender || "female") as "male" | "female" | "neutral",
        voice_speed: (data.voice_speed || "normal") as "slow" | "normal" | "fast",
        cancellation_policy: data.cancellation_policy || "",
        min_booking_notice_hours: data.min_booking_notice_hours || 2,
        max_days_advance: data.max_days_advance || 30,
        min_cancellation_notice_hours: data.min_cancellation_notice_hours || 24,
        notification_email: data.notification_email || "",
      });
      
      const langCode = languageMap[data.app_language] || "en";
      i18n.changeLanguage(langCode);
      localStorage.setItem('i18nextLng', langCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Update business table
    const { error: bizError } = await supabase
      .from("businesses")
      .update(formData)
      .eq("id", businessId);

    // Update settings table
    const { error: settingsError } = await supabase
      .from("business_settings")
      .upsert([{
        business_id: businessId,
        ...settingsData,
      }], {
        onConflict: "business_id"
      });

    if (bizError || settingsError) {
      toast({
        title: t("common.error"),
        description: t("businessInfo.updateError"),
        variant: "destructive",
      });
    } else {
      const langCode = languageMap[settingsData.app_language] || "en";
      i18n.changeLanguage(langCode);
      localStorage.setItem('i18nextLng', langCode);
      
      toast({
        title: t("common.success"),
        description: t("businessInfo.updateSuccess"),
      });
      onUpdate();
    }

    setLoading(false);
  };

  const handlePolicyExtracted = (policies: any) => {
    setSettingsData({
      ...settingsData,
      cancellation_policy: policies.cancellation_policy || settingsData.cancellation_policy,
      min_booking_notice_hours: policies.min_booking_notice_hours || settingsData.min_booking_notice_hours,
      max_days_advance: policies.max_days_advance || settingsData.max_days_advance,
      min_cancellation_notice_hours: policies.min_cancellation_notice_hours || settingsData.min_cancellation_notice_hours,
    });
  };

  const handleWebsiteAnalysis = (analysis: any) => {
    console.log("Website analysis completed:", analysis);
    toast({
      title: "Analysis Complete",
      description: "Review the extracted data in the analysis results.",
    });
  };

  return (
    <div className="space-y-6">
      {/* AI Website Analysis */}
      <WebsiteAnalysis 
        businessId={businessId} 
        currentWebsite={business?.website || ""}
        onAnalysisComplete={handleWebsiteAnalysis}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t("businessInfo.title")}
            </CardTitle>
            <CardDescription>{t("businessInfo.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">{t("businessInfo.businessName")} *</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("businessInfo.address")} *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="main_phone">{t("businessInfo.mainPhone")} *</Label>
                <Input
                  id="main_phone"
                  value={formData.main_phone}
                  onChange={(e) => setFormData({ ...formData, main_phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_phone">{t("businessInfo.secondaryPhone")}</Label>
                <Input
                  id="secondary_phone"
                  value={formData.secondary_phone}
                  onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t("businessInfo.website")}</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location & Currency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t("localization.title")}
            </CardTitle>
            <CardDescription>{t("localization.countryHelp")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("localization.country")} *</Label>
                <Select
                  value={settingsData.country}
                  onValueChange={(value) => setSettingsData({ ...settingsData, country: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Spain">Spain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("localization.currency")} *</Label>
                <Select
                  value={settingsData.currency}
                  onValueChange={(value) => setSettingsData({ ...settingsData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
                    <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                    <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    <SelectItem value="CAD">$ Canadian Dollar (CAD)</SelectItem>
                    <SelectItem value="AUD">$ Australian Dollar (AUD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("localization.language")} *</Label>
                <Select
                  value={settingsData.app_language}
                  onValueChange={(value) => setSettingsData({ ...settingsData, app_language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Spanish">Español (Spanish)</SelectItem>
                    <SelectItem value="French">Français (French)</SelectItem>
                    <SelectItem value="German">Deutsch (German)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assistant Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {t("assistantSettings.title")}
            </CardTitle>
            <CardDescription>{t("assistantSettings.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("assistantSettings.assistantName")} *</Label>
              <Input
                value={settingsData.assistant_name}
                onChange={(e) => setSettingsData({ ...settingsData, assistant_name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("assistantSettings.primaryLanguage")} *</Label>
                <Select
                  value={settingsData.primary_language}
                  onValueChange={(value) => setSettingsData({ ...settingsData, primary_language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">{t("assistantSettings.english")}</SelectItem>
                    <SelectItem value="Spanish">{t("assistantSettings.spanish")}</SelectItem>
                    <SelectItem value="French">{t("assistantSettings.french")}</SelectItem>
                    <SelectItem value="German">{t("assistantSettings.german")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("assistantSettings.tone")} *</Label>
                <Select
                  value={settingsData.tone}
                  onValueChange={(value: "casual" | "neutral" | "formal") => setSettingsData({ ...settingsData, tone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">{t("assistantSettings.casual")}</SelectItem>
                    <SelectItem value="neutral">{t("assistantSettings.neutral")}</SelectItem>
                    <SelectItem value="formal">{t("assistantSettings.formal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("assistantSettings.voiceGender")} *</Label>
                <Select
                  value={settingsData.voice_gender}
                  onValueChange={(value: "male" | "female" | "neutral") => setSettingsData({ ...settingsData, voice_gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">{t("assistantSettings.female")}</SelectItem>
                    <SelectItem value="male">{t("assistantSettings.male")}</SelectItem>
                    <SelectItem value="neutral">{t("assistantSettings.neutralGender")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("assistantSettings.voiceSpeed")} *</Label>
                <Select
                  value={settingsData.voice_speed}
                  onValueChange={(value: "slow" | "normal" | "fast") => setSettingsData({ ...settingsData, voice_speed: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">{t("assistantSettings.slow")}</SelectItem>
                    <SelectItem value="normal">{t("assistantSettings.normal")}</SelectItem>
                    <SelectItem value="fast">{t("assistantSettings.fast")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Booking Policies & Notifications
            </CardTitle>
            <CardDescription>Configure your cancellation policy and booking rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cancellation/Refund Policy *</Label>
              <Textarea
                value={settingsData.cancellation_policy}
                onChange={(e) => setSettingsData({ ...settingsData, cancellation_policy: e.target.value })}
                placeholder="Describe your cancellation and refund policy..."
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Min. Booking Notice (hours) *</Label>
                <Input
                  type="number"
                  value={settingsData.min_booking_notice_hours}
                  onChange={(e) => setSettingsData({ ...settingsData, min_booking_notice_hours: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Max Days in Advance *</Label>
                <Input
                  type="number"
                  value={settingsData.max_days_advance}
                  onChange={(e) => setSettingsData({ ...settingsData, max_days_advance: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Min. Cancellation Notice (hours) *</Label>
                <Input
                  type="number"
                  value={settingsData.min_cancellation_notice_hours}
                  onChange={(e) => setSettingsData({ ...settingsData, min_cancellation_notice_hours: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notification Email *</Label>
              <Input
                type="email"
                value={settingsData.notification_email}
                onChange={(e) => setSettingsData({ ...settingsData, notification_email: e.target.value })}
                placeholder="notifications@yourbusiness.com"
                required
              />
            </div>

            <Separator />
            
            <PolicyUpload onPolicyExtracted={handlePolicyExtracted} />
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </form>

      {/* Read-only Twilio Settings */}
      <TwilioSettings business={business} />
    </div>
  );
};
