import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { VoiceSelector } from "./VoiceSelector";
import { Bot, MessageSquare } from "lucide-react";

interface AISettingsTabProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const AISettingsTab = ({ businessId, business, onUpdate }: AISettingsTabProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
    assistant_name: "Aivia",
    primary_language: "English",
    tone: "neutral" as "casual" | "neutral" | "formal",
    voice_gender: "female" as "male" | "female" | "neutral",
    voice_speed: "normal" as "slow" | "normal" | "fast",
    elevenlabs_voice_id: null as string | null,
    opening_context: "" as string,
    business_name_phonetic: "" as string,
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
        assistant_name: data.assistant_name || "Aivia",
        primary_language: data.primary_language || "English",
        tone: (data.tone || "neutral") as "casual" | "neutral" | "formal",
        voice_gender: (data.voice_gender || "female") as "male" | "female" | "neutral",
        voice_speed: (data.voice_speed || "normal") as "slow" | "normal" | "fast",
        elevenlabs_voice_id: (data as any).elevenlabs_voice_id || null,
        opening_context: (data as any).opening_context || "",
        business_name_phonetic: (data as any).business_name_phonetic || "",
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
        ...settingsData,
      }], {
        onConflict: "business_id"
      });

    if (error) {
      toast({
        title: t("common.error"),
        description: "Failed to update AI settings",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "AI settings updated successfully",
      });
      onUpdate();
    }

    setLoading(false);
  };


  return (
    <div className="space-y-6">
      {/* AI Assistant Settings */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {t("assistantSettings.title")}
            </CardTitle>
            <CardDescription>{t("assistantSettings.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t("assistantSettings.assistantName")} *</Label>
              <Input
                value={settingsData.assistant_name}
                onChange={(e) => setSettingsData({ ...settingsData, assistant_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Phonetic Business Name</Label>
              <Input
                value={settingsData.business_name_phonetic}
                onChange={(e) => setSettingsData({ ...settingsData, business_name_phonetic: e.target.value })}
                placeholder='e.g., "Peet-zuh Nah-poh-lee" for Pizza Napoli'
              />
              <p className="text-xs text-muted-foreground">
                Write out how your business name should be pronounced. Leave blank if the spelling is straightforward.
              </p>
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

            <div className="space-y-2">
              <Label>{t("assistantSettings.voiceSpeed")} *</Label>
              <Select
                value={settingsData.voice_speed}
                onValueChange={(value: "slow" | "normal" | "fast") => setSettingsData({ ...settingsData, voice_speed: value })}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">{t("assistantSettings.slow")}</SelectItem>
                  <SelectItem value="normal">{t("assistantSettings.normal")}</SelectItem>
                  <SelectItem value="fast">{t("assistantSettings.fast")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Voice Selector with Preview */}
            <div className="pt-4 border-t">
              <VoiceSelector
                selectedVoiceId={settingsData.elevenlabs_voice_id}
                onVoiceSelect={(voiceId) => setSettingsData({ ...settingsData, elevenlabs_voice_id: voiceId })}
                primaryLanguage={settingsData.primary_language}
                businessName={business?.business_name}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? "Saving..." : "Save AI Settings"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Opening Context Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Opening Context
          </CardTitle>
          <CardDescription>
            Add announcements, promotions, or key information you'd like the AI to naturally mention at the start of calls. 
            The AI will incorporate this in its own words based on its personality - it won't read it word-for-word.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opening_context">What should the AI mention when answering?</Label>
            <Textarea
              id="opening_context"
              value={settingsData.opening_context}
              onChange={(e) => setSettingsData({ ...settingsData, opening_context: e.target.value })}
              placeholder="e.g., We're running a 20% off promotion this week on all haircuts. Also, we're closed on Monday for staff training."
              className="min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {settingsData.opening_context.length}/500 characters • The AI will naturally weave this into its greeting
            </p>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Example:</p>
            <p className="text-sm text-muted-foreground">
              If you enter: "We're offering 20% off this week and parking is now free in the rear lot"
            </p>
            <p className="text-sm text-muted-foreground">
              The AI might say: "Hey there, thanks for calling! Just a heads up - we've got 20% off everything this week, 
              and if you're driving, there's free parking round the back. How can I help you today?"
            </p>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full md:w-auto"
          >
            {loading ? "Saving..." : "Save Opening Context"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
