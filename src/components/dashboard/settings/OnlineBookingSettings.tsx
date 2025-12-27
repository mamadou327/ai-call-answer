import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Globe, Loader2, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { LogoUpload } from "./LogoUpload";
import { SocialMediaSettings } from "./SocialMediaSettings";
import { GalleryManagement } from "./GalleryManagement";

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
      });
    }
  }, [business]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Normalize domain input
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
          // Reset verification if domain changed
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
      });

      if (data.verified) {
        toast({
          title: "Domain verified!",
          description: "Your custom domain is now active.",
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

  // Use production URL for display
  const aiviaBookingUrl = `https://aiviaapp.co.uk/book/${settings.booking_slug}`;
  const customBookingUrl = settings.custom_booking_domain 
    ? `https://${settings.custom_booking_domain}`
    : null;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Booking link has been copied to clipboard.",
    });
  };

  // Validate domain input (no protocols or paths)
  const validateDomainInput = (value: string) => {
    // Remove protocol and path on input
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  };

  const getVerificationBadge = () => {
    if (!settings.custom_booking_domain) return null;

    if (domainVerification.verified) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }

    if (domainVerification.statusMessage) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Not Verified
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
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

          {/* Custom Domain Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Custom Domain (Optional)</Label>
              {getVerificationBadge()}
            </div>
            
            <div className="space-y-2">
              <Input
                value={settings.custom_booking_domain}
                onChange={(e) =>
                  setSettings({ ...settings, custom_booking_domain: validateDomainInput(e.target.value) })
                }
                placeholder="booking.yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                Enter the subdomain you want to use for your booking page (e.g., booking.yourbusiness.com)
              </p>
            </div>

            {settings.custom_booking_domain && (
              <>
                {/* DNS Instructions */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">DNS Configuration Required</p>
                      <p className="text-sm">To use your custom domain, add this DNS record at your domain provider:</p>
                      <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                        <div><span className="text-muted-foreground">Type:</span> A</div>
                        <div><span className="text-muted-foreground">Host/Name:</span> {settings.custom_booking_domain.split('.')[0]} <span className="text-xs text-muted-foreground">(or @ for root domain)</span></div>
                        <div><span className="text-muted-foreground">Value/Points to:</span> 185.158.133.1</div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        DNS changes can take up to 24-48 hours to propagate. After adding the record, click "Verify Domain" to check.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Verify Button */}
                <Button 
                  variant="outline" 
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="w-full"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verify Domain
                    </>
                  )}
                </Button>

                {/* Verification Status */}
                {domainVerification.statusMessage && (
                  <Alert variant={domainVerification.verified ? "default" : "destructive"}>
                    {domainVerification.verified ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {domainVerification.statusMessage}
                      {domainVerification.lastChecked && (
                        <p className="text-xs mt-1 opacity-70">
                          Last checked: {new Date(domainVerification.lastChecked).toLocaleString()}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Custom Domain URL (when verified) */}
                {domainVerification.verified && customBookingUrl && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Your custom booking link:</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded flex-1 truncate border border-green-500/20">
                        {customBookingUrl}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyLink(customBookingUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(customBookingUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
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

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Customize your booking page appearance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload
            businessId={businessId}
            currentLogoUrl={business?.logo_url}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardContent className="pt-6">
          <SocialMediaSettings
            businessId={businessId}
            business={business}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* Gallery */}
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
