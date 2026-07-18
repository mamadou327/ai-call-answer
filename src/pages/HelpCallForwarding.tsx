import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Smartphone, Settings as SettingsIcon, CheckCircle2, LifeBuoy, Copy, Check } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const HelpCallForwarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [aiviaNumber, setAiviaNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: biz } = await supabase
        .from("businesses")
        .select("twilio_phone_number")
        .eq("user_id", user.id)
        .maybeSingle();
      setAiviaNumber(biz?.twilio_phone_number || null);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const displayNumber = aiviaNumber || "[Aivia number]";
  const stripped = aiviaNumber ? aiviaNumber.replace(/\s+/g, "") : "[Aivia number]";

  const copyNumber = async () => {
    if (!aiviaNumber) return;
    await navigator.clipboard.writeText(aiviaNumber);
    setCopied(true);
    toast({ title: "Copied", description: "Aivia number copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={aiviaLogo} alt="Aivia" className="h-8 w-auto" />
            <span className="text-xl font-bold">AIVIA</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl flex-1">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">How to set up call forwarding</h1>
          <p className="text-muted-foreground text-lg">
            To start using Aivia, you need to forward your business phone calls to your Aivia number. This takes about 2 minutes.
          </p>
        </div>

        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Your Aivia number
            </CardTitle>
            <CardDescription>Use this number when dialling the forwarding codes below.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-56" />
            ) : aiviaNumber ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-3xl font-bold tracking-tight">{aiviaNumber}</span>
                <Button size="sm" variant="outline" onClick={copyNumber}>
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Not configured yet — contact support.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              Forward all calls
            </CardTitle>
            <CardDescription>This sends every call to Aivia. Your phone will not ring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">For most UK mobile networks (EE, Three, Vodafone, O2)</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-muted-foreground min-w-[110px]">To activate:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">**21*{stripped}#</code> and press call</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground min-w-[110px]">To deactivate:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">##21#</code> and press call</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">For BT landlines</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-muted-foreground min-w-[110px]">To activate:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">*21*{stripped}#</code></span></li>
                <li className="flex gap-2"><span className="text-muted-foreground min-w-[110px]">To deactivate:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">#21#</code></span></li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Forward when busy or unanswered
            </CardTitle>
            <CardDescription>This sends calls to Aivia only when you cannot answer. Your phone rings first.</CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">For most UK mobile networks</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-muted-foreground min-w-[190px]">Forward when busy:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">**67*{stripped}#</code> and press call</span></li>
              <li className="flex gap-2"><span className="text-muted-foreground min-w-[190px]">Forward when no answer:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">**61*{stripped}#</code> and press call</span></li>
              <li className="flex gap-2"><span className="text-muted-foreground min-w-[190px]">Forward when unreachable:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">**62*{stripped}#</code> and press call</span></li>
              <li className="flex gap-2"><span className="text-muted-foreground min-w-[190px]">To deactivate all:</span><span>Dial <code className="px-1.5 py-0.5 bg-muted rounded font-mono">##002#</code> and press call</span></li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
              Forward from your phone settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">iPhone</p>
                <p className="text-muted-foreground">Settings → Phone → Call Forwarding → Toggle on → Enter your Aivia number</p>
              </div>
            </div>
            <div className="flex gap-3">
              <SettingsIcon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Android</p>
                <p className="text-muted-foreground">Phone app → Settings → Calls → Call Forwarding → Always Forward → Enter your Aivia number</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Testing it
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground/80 leading-relaxed">
            After setting up forwarding, call your business number from a different phone. You should hear "This call may be recorded for quality and training purposes" followed by your AI assistant greeting you. If that happens, you are live.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />
              Need help?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground/80">
            Contact us at{" "}
            <a href="mailto:support@aiviaapp.co.uk" className="text-primary hover:underline">support@aiviaapp.co.uk</a>{" "}
            or call Mo directly on{" "}
            <a href="tel:+447491004439" className="text-primary hover:underline">07491 004439</a>.
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default HelpCallForwarding;
