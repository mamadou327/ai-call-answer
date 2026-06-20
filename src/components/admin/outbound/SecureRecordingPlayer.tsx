import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Plays an outbound call recording via the proxy by first fetching a
 * short-lived signed token (requires super_admin / sub_admin permission).
 */
export function SecureRecordingPlayer({ url, className }: { url: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!url) {
          setError("no url");
          return;
        }
        // Retell / external CDN recordings — play directly.
        const match = url.match(/outbound-recording-proxy\/([^/?#]+)/);
        if (!match) {
          if (/^https?:\/\//i.test(url)) {
            if (!cancelled) setSrc(url);
          } else {
            setError("invalid url");
          }
          return;
        }
        // Twilio proxy path — needs short-lived signed token.
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) {
          setError("not signed in");
          return;
        }
        const signUrl = `${url}?action=sign`;
        const r = await fetch(signUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          setError(`sign failed (${r.status})`);
          return;
        }
        const { token: t } = await r.json();
        if (!cancelled) setSrc(`${url}?token=${encodeURIComponent(t)}`);
      } catch (e) {
        setError(String((e as Error)?.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <span className="text-xs text-muted-foreground">recording unavailable</span>;
  if (!src) return <span className="text-xs text-muted-foreground">loading…</span>;
  return <audio controls src={src} className={className} />;
}
