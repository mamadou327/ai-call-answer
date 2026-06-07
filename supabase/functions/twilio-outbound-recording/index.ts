import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const form = await req.formData();
    const callSid = form.get("CallSid")?.toString();
    const recordingSid = form.get("RecordingSid")?.toString();
    const recordingUrl = form.get("RecordingUrl")?.toString();
    const duration = form.get("RecordingDuration")?.toString();
    const status = form.get("RecordingStatus")?.toString();

    console.log("[twilio-outbound-recording] callback", { callSid, recordingSid, status, duration });

    if (!callSid || !recordingSid) return new Response("ok", { headers: corsHeaders });
    if (status && status !== "completed") return new Response("ok", { headers: corsHeaders });

    // Proxy URL — browser-playable, auth handled server-side
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
