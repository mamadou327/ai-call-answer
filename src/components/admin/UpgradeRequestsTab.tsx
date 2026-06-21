import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TIERS, SubscriptionTier } from "@/lib/tiers";
import { Check, X, Crown, Loader2 } from "lucide-react";

interface UpgradeRequest {
  id: string;
  business_id: string | null;
  business_name: string | null;
  current_tier: string | null;
  requested_tier: string;
  contact_email: string | null;
  feature_name: string | null;
  notes: string | null;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500/10 text-yellow-600">Pending</Badge>;
    case "approved":
      return <Badge className="bg-green-500/10 text-green-600">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/10 text-red-600">Dismissed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const tierLabel = (key: string | null | undefined) => {
  if (!key) return "—";
  return TIERS[key as SubscriptionTier]?.name || key;
};

export const UpgradeRequestsTab = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("upgrade_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load upgrade requests", description: error.message, variant: "destructive" });
    } else {
      setRequests((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("upgrade_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "upgrade_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const approve = async (r: UpgradeRequest) => {
    if (!r.business_id) {
      toast({ title: "No linked business", description: "Cannot auto-apply tier without a business id.", variant: "destructive" });
      return;
    }
    setActingOn(r.id);
    try {
      const { error: settingsError } = await supabase
        .from("business_settings")
        .update({ subscription_tier: r.requested_tier as SubscriptionTier })
        .eq("business_id", r.business_id);
      if (settingsError) throw settingsError;

      const { error: reqError } = await supabase
        .from("upgrade_requests")
        .update({ status: "approved", resolved_at: new Date().toISOString() })
        .eq("id", r.id);
      if (reqError) throw reqError;

      toast({ title: "Upgrade applied", description: `${r.business_name} moved to ${tierLabel(r.requested_tier)}.` });
      load();
    } catch (e: any) {
      toast({ title: "Could not approve", description: e?.message, variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  const dismiss = async (r: UpgradeRequest) => {
    setActingOn(r.id);
    try {
      const { error } = await supabase
        .from("upgrade_requests")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      toast({ title: "Request dismissed" });
      load();
    } catch (e: any) {
      toast({ title: "Could not dismiss", description: e?.message, variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  const rows = tab === "pending" ? requests.filter(r => r.status === "pending") : requests;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Upgrade Requests
        </CardTitle>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({requests.filter(r => r.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No upgrade requests.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Current → Requested</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.business_name || "—"}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{tierLabel(r.current_tier)}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{tierLabel(r.requested_tier)}</span>
                  </TableCell>
                  <TableCell className="text-sm">{r.contact_email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.feature_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve(r)}
                          disabled={actingOn === r.id || !r.business_id}
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve & apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dismiss(r)}
                          disabled={actingOn === r.id}
                        >
                          <X className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : ""}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
