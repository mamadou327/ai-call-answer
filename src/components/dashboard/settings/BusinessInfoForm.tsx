import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface BusinessInfoFormProps {
  businessId: string;
  business: any;
  onUpdate: () => void;
}

export const BusinessInfoForm = ({ businessId, business, onUpdate }: BusinessInfoFormProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: business?.business_name || "",
    address: business?.address || "",
    main_phone: business?.main_phone || "",
    secondary_phone: business?.secondary_phone || "",
    website: business?.website || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("businesses")
      .update(formData)
      .eq("id", businessId);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("businessInfo.updateError"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("businessInfo.updateSuccess"),
      });
      onUpdate();
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("businessInfo.title")}</CardTitle>
        <CardDescription>{t("businessInfo.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">{t("businessInfo.businessName")} *</Label>
            <Input
              id="business_name"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("businessInfo.address")} *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="main_phone">{t("businessInfo.mainPhone")} *</Label>
              <Input
                id="main_phone"
                value={formData.main_phone}
                onChange={(e) => setFormData({ ...formData, main_phone: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone">{t("businessInfo.secondaryPhone")}</Label>
              <Input
                id="secondary_phone"
                value={formData.secondary_phone}
                onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">{t("businessInfo.website")}</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};