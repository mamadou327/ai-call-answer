import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Globe, Loader2, ChevronDown, Palette, Code2 } from "lucide-react";
import { LogoUpload } from "./LogoUpload";
import { HeroImageUpload } from "./HeroImageUpload";
import { CustomDomainWizard } from "./CustomDomainWizard";
import { WidgetSnippet } from "./WidgetSnippet";

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
    brand_color: business?.brand_color || "#0F172A",
    about_description: business?.about_description || "",
  });

  // Collapsible state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    widget: false,
    customDomain: false,
    branding: false,
    socialMedia: false,
    gallery: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (business) {
      setSettings({
        online_booking_enabled: business.online_booking_enabled || false,
        booking_slug: business.booking_slug || "",
        custom_booking_domain: business.custom_booking_domain || "",
        online_booking_message: business.online_booking_message || "",
        deposit_collection_timing: business.deposit_collection_timing || "after_booking",
        brand_color: business.brand_color || "#0F172A",
        about_description: business.about_description || "",
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
          brand_color: settings.brand_color || "#0F172A",
          about_description: settings.about_description || null,
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

  const aiviaBookingUrl = `https://aiviaapp.co.uk/book/${settings.booking_slug}`;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Booking link has been copied to clipboard.",
    });
  };

  return (
    <div className="space-y-4">
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

      {/* Website Widget - Collapsible */}
      <Collapsible open={openSections.widget} onOpenChange={() => toggleSection("widget")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Website Widget</CardTitle>
                    <CardDescription className="text-sm">
                      Embed a floating "Book Now" button on your existing website
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.widget ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <WidgetSnippet slug={settings.booking_slug} enabled={settings.online_booking_enabled} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Custom Domain - Collapsible */}
      <Collapsible open={openSections.customDomain} onOpenChange={() => toggleSection("customDomain")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Custom Domain</CardTitle>
                    <CardDescription className="text-sm">Use your own domain for the booking page</CardDescription>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.customDomain ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CustomDomainWizard
                domain={settings.custom_booking_domain}
                onDomainChange={(domain) => setSettings({ ...settings, custom_booking_domain: domain })}
                bookingUrl={aiviaBookingUrl}
                onCopyUrl={copyLink}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Branding - Collapsible */}
      <Collapsible open={openSections.branding} onOpenChange={() => toggleSection("branding")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Branding</CardTitle>
                    <CardDescription className="text-sm">Customize your booking page appearance</CardDescription>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.branding ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              <LogoUpload
                businessId={businessId}
                currentLogoUrl={business?.logo_url}
                onUpdate={onUpdate}
              />

              <HeroImageUpload
                businessId={businessId}
                currentHeroUrl={business?.hero_image_url}
                onUpdate={onUpdate}
              />

              <div className="space-y-2">
                <Label>Brand Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.brand_color}
                    onChange={(e) => setSettings({ ...settings, brand_color: e.target.value })}
                    className="h-10 w-14 rounded-md border bg-background cursor-pointer p-1"
                    aria-label="Brand colour picker"
                  />
                  <Input
                    value={settings.brand_color}
                    onChange={(e) => setSettings({ ...settings, brand_color: e.target.value })}
                    placeholder="#0F172A"
                    className="max-w-[160px] font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This colour will be used for buttons and accents on your booking page.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>About</Label>
                  <span className="text-xs text-muted-foreground">
                    {settings.about_description.length}/500
                  </span>
                </div>
                <Textarea
                  value={settings.about_description}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      about_description: e.target.value.slice(0, 500),
                    })
                  }
                  placeholder="Tell clients what makes your business special"
                  rows={4}
                  maxLength={500}
                />
              </div>

              <Button onClick={handleSave} disabled={loading} size="sm">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Branding"
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

    </div>
  );
};
