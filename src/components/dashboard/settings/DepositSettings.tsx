import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, AlertTriangle } from "lucide-react";

interface DepositSettingsProps {
  businessId: string;
  onUpdate: () => void;
}

export const DepositSettings = ({ businessId, onUpdate }: DepositSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    auto_cancel_unpaid_bookings: false,
    auto_cancel_hours: 12,
    sms_reminder_hours: 3,
  });

  useEffect(() => {
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_settings")
        .select("auto_cancel_unpaid_bookings, auto_cancel_hours, sms_reminder_hours")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSettings({
          auto_cancel_unpaid_bookings: data.auto_cancel_unpaid_bookings || false,
          auto_cancel_hours: data.auto_cancel_hours || 12,
          sms_reminder_hours: data.sms_reminder_hours || 3,
        });
      }
    } catch (error: any) {
      console.error("Error loading deposit settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("business_settings")
        .update({
          auto_cancel_unpaid_bookings: settings.auto_cancel_unpaid_bookings,
          auto_cancel_hours: settings.auto_cancel_hours,
        })
        .eq("business_id", businessId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Deposit settings saved",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Validation: auto_cancel_hours should be less than sms_reminder_hours
  const hasTimingConflict = settings.auto_cancel_unpaid_bookings && 
    settings.auto_cancel_hours >= settings.sms_reminder_hours;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <CardTitle>Deposit Settings</CardTitle>
        </div>
        <CardDescription>
          Configure automatic cancellation for unpaid deposits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-cancel">Auto-cancel unpaid bookings</Label>
            <p className="text-sm text-muted-foreground">
              Automatically cancel bookings if the deposit is not paid in time
            </p>
          </div>
          <Switch
            id="auto-cancel"
            checked={settings.auto_cancel_unpaid_bookings}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, auto_cancel_unpaid_bookings: checked })
            }
          />
        </div>

        {settings.auto_cancel_unpaid_bookings && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-hours">Cancel if unpaid within (hours)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cancel-hours"
                  type="number"
                  min={1}
                  max={72}
                  value={settings.auto_cancel_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      auto_cancel_hours: parseInt(e.target.value) || 12,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  hours before appointment
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Bookings will be automatically cancelled if the deposit is not paid 
                within this time before the appointment starts.
              </p>
            </div>

            {hasTimingConflict && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Your auto-cancel window ({settings.auto_cancel_hours} hours) 
                  is greater than or equal to your SMS reminder timing ({settings.sms_reminder_hours} hours). 
                  This means customers may be cancelled before receiving their reminder SMS. 
                  Consider setting auto-cancel hours to be less than {settings.sms_reminder_hours} hours.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};