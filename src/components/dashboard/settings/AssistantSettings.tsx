import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AssistantSettingsProps {
  businessId: string;
  onUpdate: () => void;
}

export const AssistantSettings = ({ businessId, onUpdate }: AssistantSettingsProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    assistant_name: "Aivia",
    primary_language: "English",
    tone: "neutral" as "casual" | "neutral" | "formal",
    voice_gender: "female" as "male" | "female" | "neutral",
    voice_speed: "normal" as "slow" | "normal" | "fast",
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
      setFormData({
        assistant_name: data.assistant_name || "Aivia",
        primary_language: data.primary_language || "English",
        tone: (data.tone || "neutral") as "casual" | "neutral" | "formal",
        voice_gender: (data.voice_gender || "female") as "male" | "female" | "neutral",
        voice_speed: (data.voice_speed || "normal") as "slow" | "normal" | "fast",
      });
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
        title: t("common.error"),
        description: t("assistantSettings.updateError"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("assistantSettings.updateSuccess"),
      });
      onUpdate();
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("assistantSettings.title")}</CardTitle>
        <CardDescription>{t("assistantSettings.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assistant_name">{t("assistantSettings.assistantName")} *</Label>
            <Input
              id="assistant_name"
              value={formData.assistant_name}
              onChange={(e) => setFormData({ ...formData, assistant_name: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="language">{t("assistantSettings.primaryLanguage")} *</Label>
              <Select
                value={formData.primary_language}
                onValueChange={(value) => setFormData({ ...formData, primary_language: value })}
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
              <Label htmlFor="tone">{t("assistantSettings.tone")} *</Label>
              <Select
                value={formData.tone}
                onValueChange={(value: "casual" | "neutral" | "formal") => setFormData({ ...formData, tone: value })}
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
              <Label htmlFor="voice_gender">{t("assistantSettings.voiceGender")} *</Label>
              <Select
                value={formData.voice_gender}
                onValueChange={(value: "male" | "female" | "neutral") => setFormData({ ...formData, voice_gender: value })}
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
              <Label htmlFor="voice_speed">{t("assistantSettings.voiceSpeed")} *</Label>
              <Select
                value={formData.voice_speed}
                onValueChange={(value: "slow" | "normal" | "fast") => setFormData({ ...formData, voice_speed: value })}
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

          <Button type="submit" disabled={loading}>
            {loading ? t("common.saving") : t("common.saveSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};