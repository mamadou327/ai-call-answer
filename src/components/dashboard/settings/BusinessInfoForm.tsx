import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { MapPin, Store, Share2 } from "lucide-react";
import { WebsiteSyncSection } from "./WebsiteSyncSection";

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

const businessTypeOptions = [
  { value: "salon", label: "Salon / Service Business" },
  { value: "restaurant_pickup", label: "Restaurant - Pickup/Takeaway" },
  { value: "restaurant_dine_in", label: "Restaurant - Dine-in" },
  { value: "restaurant_hybrid", label: "Restaurant - Both Pickup & Dine-in" },
];

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
    business_type: business?.business_type || "salon",
  });

  // Localization settings
  const [settingsData, setSettingsData] = useState({
    country: "United Kingdom",
    currency: "GBP",
    app_language: "English",
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

  return (
    <div className="space-y-6">
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
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label className="flex items-center gap-1.5">
                  <Store className="w-4 h-4" />
                  Business Type *
                </Label>
                <Select
                  value={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing this will update your dashboard features
                </p>
              </div>
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

            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? t("common.saving") : t("common.saveChanges")}
            </Button>
          </CardContent>
        </Card>
      </form>
      <WebsiteSyncSection businessId={businessId} business={business} onUpdate={onUpdate} />
    </div>
  );
};
