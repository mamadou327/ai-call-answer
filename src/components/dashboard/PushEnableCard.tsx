import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getPushState, subscribeToPush } from "@/lib/push/subscribe";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "aivia_push_prompt_dismissed";

export const PushEnableCard = ({ businessId }: { businessId: string }) => {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = async () => {
    const s = await getPushState();
    setSupported(s.supported);
    setSubscribed(s.subscribed);
    setPermission(s.permission);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    refresh();
  }, []);

  if (!supported) return null;
  // Hide the "enable" prompt if user dismissed and isn't subscribed. Always show if subscribed (for test button).
  if (!subscribed && dismissed) return null;
  if (!subscribed && permission === "denied") return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const enable = async () => {
    setBusy(true);
    const res = await subscribeToPush(businessId);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Notifications enabled", description: "You'll get alerts for new bookings, messages and missed calls." });
      localStorage.setItem(DISMISS_KEY, "1");
      await refresh();
    } else {
      toast({ title: "Couldn't enable notifications", description: res.error || "Please try again.", variant: "destructive" });
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-test", { body: {} });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      if (sent > 0) {
        toast({ title: "Test sent", description: `Delivered to ${sent} device(s). Check your notifications.` });
      } else {
        toast({
          title: "No devices received it",
          description: "Your subscription may be stale. Tap Enable to re-subscribe.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Test failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3 sm:p-4">
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">
          {subscribed ? "Push notifications enabled" : "Enable push notifications"}
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {subscribed
            ? "Send yourself a test to confirm it's working on this device."
            : "Get alerted the moment Aivia takes a booking, message or missed call."}
        </p>
      </div>
      {subscribed ? (
        <Button size="sm" variant="outline" onClick={sendTest} disabled={testing}>
          {testing ? "Sending…" : "Send test"}
        </Button>
      ) : (
        <>
          <Button size="sm" onClick={enable} disabled={busy}>
            {busy ? "Enabling…" : "Enable"}
          </Button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};
