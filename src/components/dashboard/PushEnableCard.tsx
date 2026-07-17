import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getPushState, subscribeToPush } from "@/lib/push/subscribe";

const DISMISS_KEY = "aivia_push_prompt_dismissed";

export const PushEnableCard = ({ businessId }: { businessId: string }) => {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    (async () => {
      const s = await getPushState();
      if (!s.supported) return;
      if (s.subscribed) return;
      if (s.permission === "denied") return;
      setShow(true);
    })();
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    const res = await subscribeToPush(businessId);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Notifications enabled", description: "You'll get alerts for new bookings, messages and missed calls." });
      localStorage.setItem(DISMISS_KEY, "1");
      setShow(false);
    } else {
      toast({
        title: "Couldn't enable notifications",
        description: res.error || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3 sm:p-4">
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Enable push notifications</p>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Get alerted the moment Aivia takes a booking, message or missed call.
        </p>
      </div>
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
    </div>
  );
};
