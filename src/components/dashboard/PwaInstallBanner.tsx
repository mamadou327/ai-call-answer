import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISS_KEY = "aivia_pwa_banner_dismissed";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  // @ts-expect-error iOS Safari
  return !!mql?.matches || !!window.navigator.standalone;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export const PwaInstallBanner = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS has no beforeinstallprompt — show banner anyway on iOS Safari
    if (isIOS()) setVisible(true);

    const installed = () => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
      }
      setDeferred(null);
    } else {
      setIosOpen(true);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
        <Smartphone className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Install Aivia on your phone</p>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Get instant booking notifications. Tap to add to your home screen.
          </p>
        </div>
        <Button size="sm" onClick={install}>Install</Button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Aivia to your home screen</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-foreground">
                <p>To install on iPhone or iPad:</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Tap the <strong>Share</strong> button in Safari.</li>
                  <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top right.</li>
                </ol>
                <p className="text-muted-foreground text-xs">
                  Push notifications require iOS 16.4 or later and Aivia to be added to your home screen.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
