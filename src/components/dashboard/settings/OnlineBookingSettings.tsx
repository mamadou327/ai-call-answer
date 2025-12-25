import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Globe, Loader2 } from "lucide-react";

interface OnlineBookingSettingsProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const OnlineBookingSettings = ({ businessId, business, onUpdate }: OnlineBookingSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    online_booking_enabled: business?.online_booking_enabled || false,
    booking_slug: business?.booking_slug || "",
    custom_booking_domain: business?.custom_booking_domain || "",
    online_booking_message: business?.online_booking_message || "",
    deposit_collection_timing: business?.deposit_collection_timing || "after_booking",
  });

  useEffect(() => {
    if (business) {
      setSettings({
        online_booking_enabled: business.online_booking_enabled || false,
        booking_slug: business.booking_slug || "",
        custom_booking_domain: business.custom_booking_domain || "",
        online_booking_message: business.online_booking_message || "",
        deposit_collection_timing: business.deposit_collection_timing || "after_booking",
      });
    }
  }, [business]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          online_booking_enabled: settings.online_booking_enabled,
          booking_slug: settings.booking_slug,
          custom_booking_domain: settings.custom_booking_domain || null,
          online_booking_message: settings.online_booking_message || null,
          deposit_collection_timing: settings.deposit_collection_timing,
        })
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Online booking settings have been updated.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const bookingUrl = `${window.location.origin}/book/${settings.booking_slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({
      title: "Link copied",
      description: "Booking link has been copied to clipboard.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Online Booking
          </CardTitle>
          <CardDescription>
            Allow customers to book appointments online through a public booking page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Online Booking</Label>
              <p className="text-sm text-muted-foreground">
                Allow customers to book appointments through your booking page
              </p>
            </div>
            <Switch
              checked={settings.online_booking_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, online_booking_enabled: checked })
              }
            />
          </div>

          {/* Booking URL */}
          <div className="space-y-2">
            <Label>Booking URL Slug</Label>
            <div className="flex gap-2">
              <Input
                value={settings.booking_slug}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    booking_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  })
                }
                placeholder="your-business-name"
              />
            </div>
            {settings.booking_slug && (
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {bookingUrl}
                </code>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(bookingUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Custom Domain */}
          <div className="space-y-2">
            <Label>Custom Domain (Optional)</Label>
            <Input
              value={settings.custom_booking_domain}
              onChange={(e) =>
                setSettings({ ...settings, custom_booking_domain: e.target.value.toLowerCase() })
              }
              placeholder="booking.yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              To use a custom domain, first connect it through your Lovable project settings, then enter it here.
            </p>
          </div>

          {/* Deposit Collection Timing */}
          <div className="space-y-2">
            <Label>Deposit Collection</Label>
            <Select
              value={settings.deposit_collection_timing}
              onValueChange={(value) =>
                setSettings({ ...settings, deposit_collection_timing: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="during_booking">
                  Collect during booking (customer pays before confirmation)
                </SelectItem>
                <SelectItem value="after_booking">
                  Collect after booking (send payment link via SMS)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose when to collect deposits for services that require them.
            </p>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label>Welcome Message (Optional)</Label>
            <Textarea
              value={settings.online_booking_message}
              onChange={(e) =>
                setSettings({ ...settings, online_booking_message: e.target.value })
              }
              placeholder="Welcome to our booking page! We look forward to seeing you."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This message will be displayed at the top of your booking page.
            </p>
          </div>

          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
