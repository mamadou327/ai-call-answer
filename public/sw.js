/* Aivia service worker — app shell caching + web push */
const CACHE = "aivia-shell-v3";
const SHELL = ["/favicon.png", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  return url.hostname.endsWith(".supabase.co") || url.pathname.startsWith("/functions/v1/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API / dynamic data — network only
  if (isApiRequest(url)) return;

  // Navigations: network-first, fall back to cached index for offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aivia</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff;text-align:center}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#888}</style></head><body><div><h1>You are offline</h1><p>Please check your internet connection and try again.</p></div></body></html>',
        { headers: { "Content-Type": "text/html" } }
      ))
    );
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/"))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Aivia", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Aivia";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "aivia",
    data: { url: data.url || "/dashboard" },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(target);
            return;
          } catch {}
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
