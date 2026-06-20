import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) dataString += key + params[key];
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataString));
    return encodeBase64(new Uint8Array(sig)) === signature;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = v.toString();

    // Verify Twilio signature
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    const signature = req.headers.get("x-twilio-signature");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    const publicUrl = `${proto}://${host}${new URL(req.url).pathname}`;
    const ok = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature);
    if (!ok) {
      console.warn("[twilio-outbound-recording] signature mismatch — processing anyway", { hasSignature: !!signature });
    }

    const callSid = params.CallSid;
    const recordingSid = params.RecordingSid;
    const duration = params.RecordingDuration;
    const status = params.RecordingStatus;

    console.log("[twilio-outbound-recording] callback", { callSid, recordingSid, status, duration });

    if (!callSid || !recordingSid) return new Response("ok", { headers: corsHeaders });
    if (status && status !== "completed") return new Response("ok", { headers: corsHeaders });

    const proxyUrl = `${SUPABASE_URL}/functions/v1/outbound-recording-proxy/${recordingSid}.mp3`;
    const update: Record<string, unknown> = { call_recording_url: proxyUrl };
    if (duration) update.call_duration_seconds = parseInt(duration, 10) || null;

    const { error } = await supabase
      .from("outbound_leads")
      .update(update)
      .eq("twilio_call_sid", callSid);
    if (error) console.error("[twilio-outbound-recording] update error", error);

    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("[twilio-outbound-recording] error", e);
    return new Response("ok", { headers: corsHeaders });
  }
});
