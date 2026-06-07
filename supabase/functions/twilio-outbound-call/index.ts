import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("outbound_leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), { status: 404, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("outbound_settings")
      .select("from_number")
      .limit(1)
      .maybeSingle();

    const fromNumber = settings?.from_number;
    if (!fromNumber) {
      return new Response(JSON.stringify({ error: "No outbound from_number configured in outbound_settings" }), { status: 400, headers: corsHeaders });
    }

    const base = SUPABASE_URL;
    const twimlUrl = `${base}/functions/v1/twilio-outbound-twiml?lead_id=${encodeURIComponent(lead_id)}`;
    const statusUrl = `${base}/functions/v1/twilio-outbound-status`;
    const recordingUrl = `${base}/functions/v1/twilio-outbound-recording`;

    const body = new URLSearchParams({
      To: lead.phone_number,
      From: fromNumber,
      Url: twimlUrl,
      StatusCallback: statusUrl,
      StatusCallbackMethod: "POST",
      Record: "true",
      RecordingStatusCallback: recordingUrl,
      RecordingStatusCallbackMethod: "POST",
    });
    ["initiated", "ringing", "answered", "completed", "no-answer", "busy", "failed"].forEach((s) =>
      body.append("StatusCallbackEvent", s)
    );

    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[twilio-outbound-call] Twilio error", data);
      await supabase.from("outbound_leads").update({ status: "no_answer", retry_count: (lead.retry_count || 0) + 1 }).eq("id", lead_id);
      return new Response(JSON.stringify({ error: "twilio_error", detail: data }), { status: 500, headers: corsHeaders });
    }

    await supabase.from("outbound_leads").update({
      status: "calling",
      twilio_call_sid: data.sid,
      last_called_at: new Date().toISOString(),
    }).eq("id", lead_id);

    return new Response(JSON.stringify({ ok: true, sid: data.sid }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[twilio-outbound-call] error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
