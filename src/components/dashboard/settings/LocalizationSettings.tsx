import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface LocalizationSettingsProps {
  businessId: string;
  onUpdate: () => void;
}

const languageMap: Record<string, string> = {
  "English": "en",
  "Spanish": "es",
  "French": "fr",
  "German": "de"
};

export const LocalizationSettings = ({ businessId, onUpdate }: LocalizationSettingsProps) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
      .select("country, currency, app_language")
      .eq("business_id", businessId)
      .single();

    if (data) {
      setFormData({
        country: data.country || "United Kingdom",
        currency: data.currency || "GBP",
        app_language: data.app_language || "English",
      });
      
      // Set i18n language based on saved preference
      const langCode = languageMap[data.app_language] || "en";
      i18n.changeLanguage(langCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("business_settings")
      .upsert([{
        business_id: businessId,
        ...formData,
      }], {
        onConflict: "business_id"
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    } else {
      // Update i18n language
      const langCode = languageMap[formData.app_language] || "en";
      i18n.changeLanguage(langCode);
      
      toast({
        title: t("localization.success"),
        description: t("localization.success"),
      });
      onUpdate();
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("localization.title")}</CardTitle>
        <CardDescription>{t("localization.countryHelp")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">{t("localization.country")} *</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => setFormData({ ...formData, country: value })}
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
            <Label htmlFor="currency">{t("localization.currency")} *</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
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
            <Label htmlFor="app_language">{t("localization.language")} *</Label>
            <Select
              value={formData.app_language}
              onValueChange={(value) => setFormData({ ...formData, app_language: value })}
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
            <p className="text-xs text-muted-foreground">{t("localization.languageHelp")}</p>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? t("localization.saving") : t("localization.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
