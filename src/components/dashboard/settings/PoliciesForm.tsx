import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface PoliciesFormProps {
  businessId: string;
  onUpdate: () => void;
}

export const PoliciesForm = ({ businessId, onUpdate }: PoliciesFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cancellation_policy: "",
    min_booking_notice_hours: 2,
    max_days_advance: 30,
    min_cancellation_notice_hours: 24,
    notification_email: "",
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
      setFormData({
        cancellation_policy: data.cancellation_policy || "",
        min_booking_notice_hours: data.min_booking_notice_hours || 2,
        max_days_advance: data.max_days_advance || 30,
        min_cancellation_notice_hours: data.min_cancellation_notice_hours || 24,
        notification_email: data.notification_email || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("business_settings")
      .upsert([{
        business_id: businessId,
        ...formData,
      }], {
        onConflict: "business_id"
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update policies.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Policies updated successfully.",
      });
      onUpdate();
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Policies & Notifications</CardTitle>
        <CardDescription>Configure your cancellation policy and booking rules</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancellation_policy">Cancellation/Refund Policy *</Label>
            <Textarea
              id="cancellation_policy"
              value={formData.cancellation_policy}
              onChange={(e) => setFormData({ ...formData, cancellation_policy: e.target.value })}
              placeholder="Describe your cancellation and refund policy..."
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="min_booking_notice">Min. Booking Notice (hours) *</Label>
              <Input
                id="min_booking_notice"
                type="number"
                value={formData.min_booking_notice_hours}
                onChange={(e) => setFormData({ ...formData, min_booking_notice_hours: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_days_advance">Max Days in Advance *</Label>
              <Input
                id="max_days_advance"
                type="number"
                value={formData.max_days_advance}
                onChange={(e) => setFormData({ ...formData, max_days_advance: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_cancellation">Min. Cancellation Notice (hours) *</Label>
              <Input
                id="min_cancellation"
                type="number"
                value={formData.min_cancellation_notice_hours}
                onChange={(e) => setFormData({ ...formData, min_cancellation_notice_hours: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification_email">Notification Email *</Label>
            <Input
              id="notification_email"
              type="email"
              value={formData.notification_email}
              onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
              placeholder="notifications@yourbusiness.com"
              required
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Policies"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};