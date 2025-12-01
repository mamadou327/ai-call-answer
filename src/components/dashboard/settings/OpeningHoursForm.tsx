import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface OpeningHoursFormProps {
  businessId: string;
  onUpdate: () => void;
}

export const OpeningHoursForm = ({ businessId, onUpdate }: OpeningHoursFormProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState<any[]>([]);

  const DAYS = [
    t("openingHours.monday"),
    t("openingHours.tuesday"),
    t("openingHours.wednesday"),
    t("openingHours.thursday"),
    t("openingHours.friday"),
    t("openingHours.saturday"),
    t("openingHours.sunday")
  ];

  useEffect(() => {
    loadHours();
  }, [businessId]);

  const loadHours = async () => {
    const { data } = await supabase
      .from("opening_hours")
      .select("*")
      .eq("business_id", businessId)
      .order("day_of_week");

    if (data && data.length > 0) {
      setHours(data);
    } else {
      // Initialize with default closed hours
      setHours(DAYS.map((_, index) => ({
        day_of_week: index,
        is_closed: true,
        open_time: "09:00",
        close_time: "17:00",
      })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Delete existing hours
    await supabase
      .from("opening_hours")
      .delete()
      .eq("business_id", businessId);

    // Insert new hours
    const { error } = await supabase
      .from("opening_hours")
      .insert(hours.map(h => ({ ...h, business_id: businessId })));

    if (error) {
      toast({
        title: t("common.error"),
        description: t("openingHours.updateError"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("openingHours.updateSuccess"),
      });
      onUpdate();
    }

    setLoading(false);
  };

  const updateDay = (index: number, field: string, value: any) => {
    const newHours = [...hours];
    newHours[index] = { ...newHours[index], [field]: value };
    setHours(newHours);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("openingHours.title")}</CardTitle>
        <CardDescription>{t("openingHours.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {DAYS.map((day, index) => (
            <div key={day} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="w-32">
                <Label>{day}</Label>
              </div>
              <Switch
                checked={!hours[index]?.is_closed}
                onCheckedChange={(checked) => updateDay(index, "is_closed", !checked)}
              />
              {!hours[index]?.is_closed && (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hours[index]?.open_time || "09:00"}
                      onChange={(e) => updateDay(index, "open_time", e.target.value)}
                      className="w-32"
                    />
                    <span>{t("openingHours.to")}</span>
                    <Input
                      type="time"
                      value={hours[index]?.close_time || "17:00"}
                      onChange={(e) => updateDay(index, "close_time", e.target.value)}
                      className="w-32"
                    />
                  </div>
                </>
              )}
              {hours[index]?.is_closed && (
                <span className="text-muted-foreground">{t("openingHours.closed")}</span>
              )}
            </div>
          ))}
          <Button type="submit" disabled={loading}>
            {loading ? t("common.saving") : t("openingHours.saveHours")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};