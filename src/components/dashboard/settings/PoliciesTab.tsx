import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PolicyUpload } from "./PolicyUpload";
import { FileText, Upload } from "lucide-react";

interface PoliciesTabProps {
  businessId: string;
  onUpdate: () => void;
}

export const PoliciesTab = ({ businessId, onUpdate }: PoliciesTabProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
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
        cancellation_policy: data.cancellation_policy ?? "",
        min_booking_notice_hours: data.min_booking_notice_hours ?? 2,
        max_days_advance: data.max_days_advance ?? 30,
        min_cancellation_notice_hours: data.min_cancellation_notice_hours ?? 24,
        notification_email: data.notification_email ?? "",
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
        title: "Error",
        description: "Failed to update policies",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Policies updated successfully",
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
    toast({
      title: "Policy Extracted",
      description: "Review the extracted policy data below and save to apply.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Booking Policies */}
      <form onSubmit={handleSubmit}>
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
              <Label>Notification Email</Label>
              <Input
                type="email"
                value={settingsData.notification_email}
                onChange={(e) => setSettingsData({ ...settingsData, notification_email: e.target.value })}
                placeholder="email@example.com"
              />
              <p className="text-sm text-muted-foreground">
                Receive booking notifications at this email address
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? "Saving..." : "Save Policies"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Upload Policy Document */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Policy Document
          </CardTitle>
          <CardDescription>
            Upload a policy document and let AI extract the relevant information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyUpload onPolicyExtracted={handlePolicyExtracted} />
        </CardContent>
      </Card>
    </div>
  );
};
