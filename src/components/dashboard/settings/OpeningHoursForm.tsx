import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface OpeningHoursFormProps {
  businessId: string;
  onUpdate: () => void;
}

type OpeningHourRow = {
  // 0 = Sunday ... 6 = Saturday (matches JS Date.getDay())
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
};

const toTimeInputValue = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  // DB often returns HH:MM:SS; <input type="time"/> expects HH:MM
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const createDefaultDay = (dayOfWeek: number): OpeningHourRow => ({
  day_of_week: dayOfWeek,
  is_closed: true,
  open_time: "09:00",
  close_time: "17:00",
});

export const OpeningHoursForm = ({ businessId, onUpdate }: OpeningHoursFormProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [hoursByDay, setHoursByDay] = useState<Record<number, OpeningHourRow>>({});

  // Keep UI Monday-first, but store/read as 0=Sunday..6=Saturday
  const dayConfigs = useMemo(
    () => [
      { dayOfWeek: 1, label: t("openingHours.monday") },
      { dayOfWeek: 2, label: t("openingHours.tuesday") },
      { dayOfWeek: 3, label: t("openingHours.wednesday") },
      { dayOfWeek: 4, label: t("openingHours.thursday") },
      { dayOfWeek: 5, label: t("openingHours.friday") },
      { dayOfWeek: 6, label: t("openingHours.saturday") },
      { dayOfWeek: 0, label: t("openingHours.sunday") },
    ],
    [t]
  );

  useEffect(() => {
    void loadHours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const loadHours = async () => {
    const { data, error } = await supabase
      .from("opening_hours")
      .select("day_of_week,is_closed,open_time,close_time")
      .eq("business_id", businessId);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("openingHours.updateError"),
        variant: "destructive",
      });
      return;
    }

    const next: Record<number, OpeningHourRow> = {};

    (data ?? []).forEach((row) => {
      next[row.day_of_week] = {
        day_of_week: row.day_of_week,
        is_closed: !!row.is_closed,
        open_time: row.open_time,
        close_time: row.close_time,
      };
    });

    // Ensure all 7 days exist
    for (let d = 0; d <= 6; d += 1) {
      if (!next[d]) next[d] = createDefaultDay(d);
    }

    setHoursByDay(next);
  };

  const updateDay = (dayOfWeek: number, patch: Partial<OpeningHourRow>) => {
    setHoursByDay((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...(prev[dayOfWeek] ?? createDefaultDay(dayOfWeek)),
        ...patch,
        day_of_week: dayOfWeek,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = Object.values(hoursByDay).map((h) => ({
      business_id: businessId,
      day_of_week: h.day_of_week,
      is_closed: h.is_closed,
      open_time: h.is_closed ? null : toTimeInputValue(h.open_time, "09:00"),
      close_time: h.is_closed ? null : toTimeInputValue(h.close_time, "17:00"),
    }));

    // Replace existing hours for this business
    const { error: deleteError } = await supabase.from("opening_hours").delete().eq("business_id", businessId);

    if (deleteError) {
      toast({
        title: t("common.error"),
        description: t("openingHours.updateError"),
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("opening_hours").insert(payload);

    if (insertError) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("openingHours.title")}</CardTitle>
        <CardDescription>{t("openingHours.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {dayConfigs.map(({ dayOfWeek, label }) => {
            const day = hoursByDay[dayOfWeek] ?? createDefaultDay(dayOfWeek);
            const isOpen = !day.is_closed;

            return (
              <div key={dayOfWeek} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-32">
                  <Label>{label}</Label>
                </div>

                <Switch checked={isOpen} onCheckedChange={(checked) => updateDay(dayOfWeek, { is_closed: !checked })} />

                {isOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={toTimeInputValue(day.open_time, "09:00")}
                      onChange={(e) => updateDay(dayOfWeek, { open_time: e.target.value })}
                      className="w-32"
                    />
                    <span>{t("openingHours.to")}</span>
                    <Input
                      type="time"
                      value={toTimeInputValue(day.close_time, "17:00")}
                      onChange={(e) => updateDay(dayOfWeek, { close_time: e.target.value })}
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t("openingHours.closed")}</span>
                )}
              </div>
            );
          })}

          <Button type="submit" disabled={loading}>
            {loading ? t("common.saving") : t("openingHours.saveHours")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
