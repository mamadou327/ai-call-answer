import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Instagram, Facebook, Twitter, Youtube, Loader2 } from "lucide-react";

interface SocialMediaSettingsProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const SocialMediaSettings = ({ businessId, business, onUpdate }: SocialMediaSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [socials, setSocials] = useState({
    social_instagram: "",
    social_facebook: "",
    social_tiktok: "",
    social_twitter: "",
    social_youtube: "",
  });

  useEffect(() => {
    if (business) {
      setSocials({
        social_instagram: business.social_instagram || "",
        social_facebook: business.social_facebook || "",
        social_tiktok: business.social_tiktok || "",
        social_twitter: business.social_twitter || "",
        social_youtube: business.social_youtube || "",
      });
    }
  }, [business]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          social_instagram: socials.social_instagram || null,
          social_facebook: socials.social_facebook || null,
          social_tiktok: socials.social_tiktok || null,
          social_twitter: socials.social_twitter || null,
          social_youtube: socials.social_youtube || null,
        })
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Social media saved",
        description: "Your social media links have been updated.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save social media links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Social Media Links</Label>
        <p className="text-sm text-muted-foreground">
          Add your social media links. Only configured links will appear on your booking page.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Instagram className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="instagram.com/yourbusiness"
            value={socials.social_instagram}
            onChange={(e) => setSocials({ ...socials, social_instagram: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Facebook className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="facebook.com/yourbusiness"
            value={socials.social_facebook}
            onChange={(e) => setSocials({ ...socials, social_facebook: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-muted-foreground flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
          </svg>
          <Input
            placeholder="tiktok.com/@yourbusiness"
            value={socials.social_tiktok}
            onChange={(e) => setSocials({ ...socials, social_tiktok: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Twitter className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="twitter.com/yourbusiness"
            value={socials.social_twitter}
            onChange={(e) => setSocials({ ...socials, social_twitter: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Youtube className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="youtube.com/@yourbusiness"
            value={socials.social_youtube}
            onChange={(e) => setSocials({ ...socials, social_youtube: e.target.value })}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Social Media"
        )}
      </Button>
    </div>
  );
};
