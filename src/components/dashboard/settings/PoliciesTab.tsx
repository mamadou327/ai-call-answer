import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

interface PoliciesTabProps {
  businessId: string;
  onUpdate: () => void;
}

export const PoliciesTab = ({ businessId, onUpdate }: PoliciesTabProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [settingsData, setSettingsData] = useState({
    cancellation_policy: "",
    min_booking_notice_hours: 2 as number | null,
    max_days_advance: 30 as number | null,
    min_cancellation_notice_hours: 24 as number | null,
    min_reschedule_notice_hours: 24 as number | null,
    notification_email: "",
  });

  // Track which toggles are enabled
  const [toggles, setToggles] = useState({
    min_booking_notice: true,
    max_days_advance: true,
    min_cancellation_notice: true,
    min_reschedule_notice: true,
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
        min_booking_notice_hours: data.min_booking_notice_hours,
        max_days_advance: data.max_days_advance,
        min_cancellation_notice_hours: data.min_cancellation_notice_hours,
        min_reschedule_notice_hours: data.min_reschedule_notice_hours,
        notification_email: data.notification_email ?? "",
      });
      
      // Set toggles based on whether values exist
      setToggles({
        min_booking_notice: data.min_booking_notice_hours != null,
        max_days_advance: data.max_days_advance != null,
        min_cancellation_notice: data.min_cancellation_notice_hours != null,
        min_reschedule_notice: data.min_reschedule_notice_hours != null,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Set values to null if toggle is off
    const dataToSave = {
      business_id: businessId,
      cancellation_policy: settingsData.cancellation_policy,
      min_booking_notice_hours: toggles.min_booking_notice ? settingsData.min_booking_notice_hours : null,
      max_days_advance: toggles.max_days_advance ? settingsData.max_days_advance : null,
      min_cancellation_notice_hours: toggles.min_cancellation_notice ? settingsData.min_cancellation_notice_hours : null,
      min_reschedule_notice_hours: toggles.min_reschedule_notice ? settingsData.min_reschedule_notice_hours : null,
      notification_email: settingsData.notification_email,
    };

    const { error } = await supabase
      .from("business_settings")
      .upsert([dataToSave], {
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

  return (
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Min. Booking Notice (hours)</Label>
                  <Switch
                    checked={toggles.min_booking_notice}
                    onCheckedChange={(checked) => setToggles({ ...toggles, min_booking_notice: checked })}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  value={settingsData.min_booking_notice_hours ?? 0}
                  onChange={(e) => setSettingsData({ ...settingsData, min_booking_notice_hours: parseInt(e.target.value) || 0 })}
                  disabled={!toggles.min_booking_notice}
                  className={!toggles.min_booking_notice ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  {toggles.min_booking_notice ? "Customers must book at least this many hours ahead" : "No minimum notice required"}
                </p>
              </div>

              <div className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Max Days in Advance</Label>
                  <Switch
                    checked={toggles.max_days_advance}
                    onCheckedChange={(checked) => setToggles({ ...toggles, max_days_advance: checked })}
                  />
                </div>
                <Input
                  type="number"
                  min="1"
                  value={settingsData.max_days_advance ?? 30}
                  onChange={(e) => setSettingsData({ ...settingsData, max_days_advance: parseInt(e.target.value) || 1 })}
                  disabled={!toggles.max_days_advance}
                  className={!toggles.max_days_advance ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  {toggles.max_days_advance ? "Limit how far ahead bookings can be made" : "No advance booking limit"}
                </p>
              </div>

              <div className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Min. Cancellation Notice (hours)</Label>
                  <Switch
                    checked={toggles.min_cancellation_notice}
                    onCheckedChange={(checked) => setToggles({ ...toggles, min_cancellation_notice: checked })}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  value={settingsData.min_cancellation_notice_hours ?? 0}
                  onChange={(e) => setSettingsData({ ...settingsData, min_cancellation_notice_hours: parseInt(e.target.value) || 0 })}
                  disabled={!toggles.min_cancellation_notice}
                  className={!toggles.min_cancellation_notice ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  {toggles.min_cancellation_notice ? "Minimum notice required to cancel" : "No cancellation notice required"}
                </p>
              </div>

              <div className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Min. Reschedule Notice (hours)</Label>
                  <Switch
                    checked={toggles.min_reschedule_notice}
                    onCheckedChange={(checked) => setToggles({ ...toggles, min_reschedule_notice: checked })}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  value={settingsData.min_reschedule_notice_hours ?? 0}
                  onChange={(e) => setSettingsData({ ...settingsData, min_reschedule_notice_hours: parseInt(e.target.value) || 0 })}
                  disabled={!toggles.min_reschedule_notice}
                  className={!toggles.min_reschedule_notice ? "opacity-50" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  {toggles.min_reschedule_notice ? "Minimum notice required to reschedule" : "No reschedule notice required"}
                </p>
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
  );
};