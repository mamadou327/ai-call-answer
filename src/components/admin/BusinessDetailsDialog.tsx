import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TIERS, TIER_ORDER, SubscriptionTier } from "@/lib/tiers";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Users,
  Clock,
  CreditCard,
  Link,
  ExternalLink
} from "lucide-react";

interface BusinessDetails {
  id: string;
  business_name: string;
  owner_email: string | null;
  owner_name: string | null;
  main_phone: string;
  secondary_phone?: string | null;
  address: string;
  website?: string | null;
  status: string;
  created_at: string | null;
  staff_count: number;
  plan_tier?: string | null;
  aivia_active: boolean;
  assigned_aivia_number?: string | null;
  // Online booking fields
  custom_booking_domain?: string | null;
  booking_slug?: string | null;
  online_booking_enabled?: boolean;
}

interface BusinessDetailsDialogProps {
  business: BusinessDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BusinessDetailsDialog = ({ business, open, onOpenChange }: BusinessDetailsDialogProps) => {
  const { toast } = useToast();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("starter");
  const [pendingTier, setPendingTier] = useState<SubscriptionTier>("starter");
  const [savingTier, setSavingTier] = useState(false);
  const [loadingTier, setLoadingTier] = useState(false);

  useEffect(() => {
    if (!business?.id || !open) return;
    setLoadingTier(true);
    supabase
      .from("business_settings")
      .select("subscription_tier")
      .eq("business_id", business.id)
      .maybeSingle()
      .then(({ data }) => {
        const t = ((data as any)?.subscription_tier as SubscriptionTier) || "starter";
        setCurrentTier(t);
        setPendingTier(t);
        setLoadingTier(false);
      });
  }, [business?.id, open]);

  const saveTier = async () => {
    if (!business) return;
    setSavingTier(true);
    try {
      // upsert so this works even if business_settings row doesn't exist yet
      const { error } = await supabase
        .from("business_settings")
        .upsert(
          { business_id: business.id, subscription_tier: pendingTier },
          { onConflict: "business_id" },
        );
      if (error) throw error;
      setCurrentTier(pendingTier);
      toast({ title: "Plan updated", description: `${business.business_name} is now on ${TIERS[pendingTier].name}.` });
    } catch (e: any) {
      toast({ title: "Could not update plan", description: e?.message, variant: "destructive" });
    } finally {
      setSavingTier(false);
    }
  };

  if (!business) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-500">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500">Rejected</Badge>;
      case "revoked":
        return <Badge className="bg-gray-500/10 text-gray-500">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="w-5 h-5" />
            {business.business_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & Plan */}
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge(business.status)}
            {business.plan_tier && (
              <Badge variant="outline" className="capitalize">
                {business.plan_tier.replace("_", " ")}
              </Badge>
            )}
            {business.aivia_active ? (
              <Badge className="bg-primary/10 text-primary">Aivia Active</Badge>
            ) : (
              <Badge variant="secondary">Aivia Inactive</Badge>
            )}
          </div>

          <Separator />

          {/* Plan management */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Subscription plan
            </h4>
            <div className="flex items-center gap-2">
              <Select
                value={pendingTier}
                onValueChange={(v) => setPendingTier(v as SubscriptionTier)}
                disabled={savingTier || loadingTier}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={loadingTier ? "Loading…" : "Select a plan"} />
                </SelectTrigger>
                <SelectContent>
                  {TIER_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIERS[t].name}
                      {TIERS[t].callLimit !== null ? ` — ${TIERS[t].callLimit} calls/mo` : " — Unlimited"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={saveTier}
                disabled={savingTier || loadingTier || pendingTier === currentTier}
              >
                {savingTier ? "Saving…" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current plan: <span className="font-medium">{TIERS[currentTier].name}</span>
              {pendingTier !== currentTier && (
                <span className="text-amber-600"> · unsaved change</span>
              )}
            </p>
          </div>

          <Separator />

          {/* Owner Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Owner Information</h4>
            <InfoRow icon={Users} label="Owner Name" value={business.owner_name} />
            <InfoRow icon={Mail} label="Owner Email" value={business.owner_email} />
          </div>

          <Separator />

          {/* Business Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Business Details</h4>
            <InfoRow icon={Phone} label="Main Phone" value={business.main_phone} />
            {business.secondary_phone && (
              <InfoRow icon={Phone} label="Secondary Phone" value={business.secondary_phone} />
            )}
            <InfoRow icon={MapPin} label="Address" value={business.address} />
            {business.website && (
              <InfoRow icon={Globe} label="Website" value={business.website} />
            )}
          </div>

          <Separator />

          {/* Online Booking Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Online Booking</h4>
            <div className="flex items-start gap-3 py-2">
              <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Online Booking</p>
                <p className="text-sm font-medium">
                  {business.online_booking_enabled ? (
                    <Badge className="bg-green-500/10 text-green-500">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </p>
              </div>
            </div>
            {business.booking_slug && (
              <InfoRow 
                icon={Link} 
                label="Booking URL" 
                value={`aiviaapp.co.uk/book/${business.booking_slug}`} 
              />
            )}
            {business.custom_booking_domain && (
              <div className="flex items-start gap-3 py-2">
                <ExternalLink className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Custom Domain</p>
                  <p className="text-sm font-medium text-primary break-words">{business.custom_booking_domain}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* System Info */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">System Information</h4>
            <InfoRow icon={Users} label="Staff Count" value={business.staff_count?.toString()} />
            <InfoRow 
              icon={Calendar} 
              label="Created" 
              value={business.created_at ? new Date(business.created_at).toLocaleDateString() : null} 
            />
            {business.assigned_aivia_number && (
              <InfoRow icon={Phone} label="Aivia Number" value={business.assigned_aivia_number} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};