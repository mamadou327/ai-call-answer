import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import aiviaLogo from "@/assets/aivia-logo-new.png";

// The managed Supabase auth.oauth namespace is beta; type it locally so we
// don't depend on TS visibility.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function getOAuthApi(): OAuthApi | null {
  const authAny = (supabase as any).auth;
  return authAny?.oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id in URL.");
      const oauth = getOAuthApi();
      if (!oauth) return setError("Managed OAuth is unavailable in this build.");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?mode=signin&next=" + encodeURIComponent(next);
        return;
      }

      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message ?? String(error));
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuthApi();
    if (!oauth) return setError("Managed OAuth is unavailable in this build.");
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message ?? String(error));
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const redirectUri: string | undefined = details?.client?.redirect_uri ?? details?.redirect_uri;
  const scopes: string[] = Array.isArray(details?.scopes)
    ? details.scopes
    : typeof details?.scope === "string"
    ? details.scope.split(/\s+/).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={aiviaLogo} alt="Aivia" className="h-16 w-auto" />
            <span className="text-2xl font-bold text-primary">Aivia</span>
          </div>
          <CardTitle className="text-xl">
            {error ? "Authorization error" : details ? `Connect ${clientName} to Aivia` : "Loading…"}
          </CardTitle>
          {details && !error && (
            <CardDescription>
              This lets {clientName} use Aivia as you — reading your bookings, customers, calls, services, and business info.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          {!error && !details && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!error && details && (
            <>
              {redirectUri && (
                <div className="text-xs text-muted-foreground break-all">
                  Redirect URI: <span className="font-mono">{redirectUri}</span>
                </div>
              )}
              <ul className="text-sm space-y-1 list-disc pl-5">
                <li>Access your Aivia business profile</li>
                <li>Read your bookings, customers, and recent calls</li>
                <li>Read your services and settings</li>
              </ul>
              {scopes.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Requested scopes: <span className="font-mono">{scopes.join(" ")}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Aivia's permissions and backend policies still control what data is accessible.
              </p>
              <div className="flex gap-2 pt-2">
                <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
                  Deny
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
