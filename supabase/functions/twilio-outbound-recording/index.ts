import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const form = await req.formData();
    const callSid = form.get("CallSid")?.toString();
    const recordingUrl = form.get("RecordingUrl")?.toString();
    const duration = form.get("RecordingDuration")?.toString();
    if (!callSid || !recordingUrl) return new Response("ok", { headers: corsHeaders });

    const fullUrl = `${recordingUrl}.mp3`;
    const update: Record<string, unknown> = { call_recording_url: fullUrl };
    if (duration) update.call_duration_seconds = parseInt(duration, 10) || null;

    await supabase.from("outbound_leads").update(update).eq("twilio_call_sid", callSid);
    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("[twilio-outbound-recording] error", e);
    return new Response("ok", { headers: corsHeaders });
  }
});
