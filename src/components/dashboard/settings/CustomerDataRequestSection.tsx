import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSearch, Loader2 } from "lucide-react";

type Biz = { id: string; business_name: string };

export const CustomerDataRequestSection = () => {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [bizId, setBizId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id);
      const list = data || [];
      setBusinesses(list);
      if (list.length === 1) setBizId(list[0].id);
    })();
  }, []);

  const handleGenerate = async () => {
    if (!bizId) {
      toast({ title: "Select a business", variant: "destructive" });
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast({ title: "Enter phone or email", description: "At least one is required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-customer-data`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ business_id: bizId, phone: phone.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `Aivia-DSAR-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = await res.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dl);
      toast({ title: "Report ready", description: "DSAR report downloaded." });
      setPhone("");
      setEmail("");
    } catch (e: any) {
      toast({ title: "Could not generate report", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Customer data request (GDPR)
        </CardTitle>
        <CardDescription>
          When an end-customer asks for a copy of everything you hold about them under GDPR
          (a Data Subject Access Request), generate their personal report here. Includes
          bookings, calls, transcripts, recordings, messages, orders and more for that single
          person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {businesses.length > 1 && (
          <div className="space-y-2">
            <Label>Business</Label>
            <Select value={bizId} onValueChange={setBizId}>
              <SelectTrigger><SelectValue placeholder="Select a business" /></SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="dsar-phone">Customer phone</Label>
            <Input
              id="dsar-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7..."
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsar-email">Customer email</Label>
            <Input
              id="dsar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading || (!phone && !email)}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Generate report
        </Button>

        <p className="text-xs text-muted-foreground">
          The report is generated as an Excel file with a separate tab per data category, plus a
          Summary tab outlining the customer's GDPR rights. Recording links are signed and expire
          after 24 hours.
        </p>
      </CardContent>
    </Card>
  );
};
