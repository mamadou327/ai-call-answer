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
import { LogoUpload } from "./LogoUpload";
import { SocialMediaSettings } from "./SocialMediaSettings";
import { GalleryManagement } from "./GalleryManagement";
import { CustomDomainWizard } from "./CustomDomainWizard";

interface OnlineBookingSettingsProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const OnlineBookingSettings = ({ businessId, business, onUpdate }: OnlineBookingSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settings, setSettings] = useState({
    online_booking_enabled: business?.online_booking_enabled || false,
    booking_slug: business?.booking_slug || "",
    custom_booking_domain: business?.custom_booking_domain || "",
    online_booking_message: business?.online_booking_message || "",
    deposit_collection_timing: business?.deposit_collection_timing || "after_booking",
  });
  const [domainVerification, setDomainVerification] = useState({
    verified: business?.custom_domain_verified || false,
    statusMessage: business?.custom_domain_status_message || "",
    lastChecked: business?.custom_domain_last_checked_at || null,
    addedToHosting: business?.custom_domain_added_to_hosting || false,
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
      setDomainVerification({
        verified: business.custom_domain_verified || false,
        statusMessage: business.custom_domain_status_message || "",
        lastChecked: business.custom_domain_last_checked_at || null,
        addedToHosting: business.custom_domain_added_to_hosting || false,
      });
    }
  }, [business]);

  const handleSave = async () => {
    setLoading(true);
    try {
      let normalizedDomain = settings.custom_booking_domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/^www\./, "");

      const { error } = await supabase
        .from("businesses")
        .update({
          online_booking_enabled: settings.online_booking_enabled,
          booking_slug: settings.booking_slug,
          custom_booking_domain: normalizedDomain || null,
          online_booking_message: settings.online_booking_message || null,
          deposit_collection_timing: settings.deposit_collection_timing,
          ...(normalizedDomain !== business?.custom_booking_domain && {
            custom_domain_verified: false,
            custom_domain_status_message: normalizedDomain ? "Domain saved. Click 'Verify Domain' to check your DNS configuration." : null,
          }),
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

  const handleVerifyDomain = async () => {
    if (!settings.custom_booking_domain) {
      toast({
        title: "No domain",
        description: "Please enter a custom domain first.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-custom-domain", {
        body: {
          business_id: businessId,
          custom_domain: settings.custom_booking_domain,
        },
      });

      if (error) throw error;

      setDomainVerification({
        verified: data.verified,
        statusMessage: data.status_message,
        lastChecked: new Date().toISOString(),
        addedToHosting: domainVerification.addedToHosting,
      });

      if (data.verified) {
        toast({
          title: "Domain verified!",
          description: "Our team has been notified and will set up SSL within 24 hours.",
        });
      } else {
        toast({
          title: "Verification pending",
          description: data.status_message,
          variant: "destructive",
        });
      }

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify domain",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const aiviaBookingUrl = `https://aiviaapp.co.uk/book/${settings.booking_slug}`;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
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
              <div className="space-y-2 mt-2">
                <Label className="text-xs text-muted-foreground">Your Aivia booking link:</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                    {aiviaBookingUrl}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyLink(aiviaBookingUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`${window.location.origin}/book/${settings.booking_slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <CustomDomainWizard
            domain={settings.custom_booking_domain}
            onDomainChange={(domain) => setSettings({ ...settings, custom_booking_domain: domain })}
            verified={domainVerification.verified}
            statusMessage={domainVerification.statusMessage}
            lastChecked={domainVerification.lastChecked}
            addedToHosting={domainVerification.addedToHosting}
            onVerify={handleVerifyDomain}
            verifying={verifying}
            onCopyUrl={copyLink}
          />

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
          </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Customize your booking page appearance</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload
            businessId={businessId}
            currentLogoUrl={business?.logo_url}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <SocialMediaSettings
            businessId={businessId}
            business={business}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <GalleryManagement
            businessId={businessId}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
};
