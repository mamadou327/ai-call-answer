// Guarded service worker registration.
// Never registers in dev, iframes, or Lovable preview contexts.

const PREVIEW_HOSTS = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
];

function isPreviewHost(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  return PREVIEW_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

async function unregisterAppSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith("/sw.js");
        })
        .map((r) => r.unregister()),
    );
  } catch {}
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const inIframe = window.top !== window.self;
  const swOff = url.searchParams.get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || swOff || isPreviewHost(window.location.hostname)) {
    await unregisterAppSW();
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[sw] registration failed", err);
  }
}
