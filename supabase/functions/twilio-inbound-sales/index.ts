// Inbound webhook for Mo's outbound sales number.
// When a prospect calls the sales number back, we:
//   1. Look them up in outbound_leads by E.164 caller id
//   2. Register a Retell call with personalised dynamic variables
//      (first_name, business_name, is_callback, prior_call_summary, current_date)
//   3. Return TwiML that SIP-dials Retell so the AI picks up the call
//   4. Log the callback on the existing lead row (status = called_back)
//
// For unknown callers, we still hand off to the same Retell agent with
// is_callback="false" so cold inbounds get the standard sales greeting.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function twimlSay(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`;
}

function twimlSip(callId: string): string {
  const sipUri = `sip:${callId}@5t4n6j0wnrl.sip.livekit.cloud`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Dial><Sip>${escapeXml(sipUri)}</Sip></Dial></Response>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = v.toString();

    const fromNumber = (params.From || "").trim();
    const toNumber = (params.To || "").trim();
    const callSid = params.CallSid || "";

    const normalisePhone = (raw: string): string => {
      let n = raw.replace(/\s+/g, "").replace(/[^\d+]/g, "");
      if (n.startsWith("00")) n = "+" + n.slice(2);
      if (n.startsWith("07") || n.startsWith("01") || n.startsWith("02")) n = "+44" + n.slice(1);
      if (!n.startsWith("+")) n = "+" + n;
      return n;
    };
    const normalisedFrom = normalisePhone(fromNumber);

    console.log("[twilio-inbound-sales] inbound", { fromNumber, normalisedFrom, toNumber, callSid });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY");
    if (!RETELL_API_KEY) {
      console.error("[twilio-inbound-sales] RETELL_API_KEY missing");
      return new Response(twimlSay("Sorry, our system is temporarily unavailable. Please try again later."), {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up the sales agent settings
    const { data: settings } = await supabase
      .from("outbound_settings")
      .select("retell_agent_id")
      .limit(1)
      .maybeSingle();
    const retellAgentId = (settings as any)?.retell_agent_id;
    if (!retellAgentId) {
      console.error("[twilio-inbound-sales] no retell_agent_id configured");
      return new Response(twimlSay("Sorry, our sales line is not configured. Please try again later."), {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Look up lead by caller's E.164. Match the most recently-touched row if duplicates exist.
    let lead: any = null;
    if (fromNumber) {
      const { data } = await supabase
        .from("outbound_leads")
        .select("id, first_name, business_name, status, call_transcript, last_called_at")
        .eq("phone_number", normalisedFrom)
        .order("last_called_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      lead = data || null;

      // Fallback: try the raw From value if normalisation changed it
      if (!lead && normalisedFrom !== fromNumber) {
        const { data: fallback } = await supabase
          .from("outbound_leads")
          .select("id, first_name, business_name, status, call_transcript, last_called_at")
          .eq("phone_number", fromNumber)
          .order("last_called_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        lead = fallback || null;
      }
    }

    const isCallback = !!lead;
    const firstName = lead?.first_name || "there";
    const businessName = lead?.business_name || "your business";
    const priorSummary = (lead?.call_transcript || "").trim().slice(-500);
    const priorStatus = lead?.status || "";

    const currentDate = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    console.log("[twilio-inbound-sales] lead lookup", { fromNumber, matched: isCallback, leadId: lead?.id, priorStatus });

    // Register the call with Retell
    const retellRes = await fetch("https://api.retellai.com/v2/register-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: retellAgentId,
        audio_encoding: "mulaw",
        audio_websocket_protocol: "twilio",
        sample_rate: 8000,
        retell_llm_dynamic_variables: {
          first_name: firstName,
          business_name: businessName,
          current_date: currentDate,
          is_callback: isCallback ? "true" : "false",
          prior_call_summary: priorSummary,
          prior_status: priorStatus,
        },
      }),
    });
    const retellData = await retellRes.json();
    if (!retellRes.ok || !retellData?.call_id) {
      console.error("[twilio-inbound-sales] Retell register error", retellRes.status, retellData);
      return new Response(twimlSay("Sorry, we couldn't connect you right now. Please try again in a moment."), {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }
    const retellCallId: string = retellData.call_id;

    // Update the lead so the analyser webhook can find this callback by retell_call_id.
    // Keep finalised statuses (demo_booked, interested, do_not_call) — only downgrade pending/no_answer/voicemail.
    if (lead?.id) {
      const update: Record<string, unknown> = {
        retell_call_id: retellCallId,
        twilio_call_sid: callSid || null,
        last_called_at: new Date().toISOString(),
      };
      if (["pending", "calling", "no_answer", "voicemail", "answered"].includes(lead.status)) {
        update.status = "called_back";
      }
      const { error: updateErr } = await supabase.from("outbound_leads").update(update).eq("id", lead.id);
      if (updateErr) console.error("[twilio-inbound-sales] lead update error", updateErr);
    }

    return new Response(twimlSip(retellCallId), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("[twilio-inbound-sales] error", e);
    return new Response(twimlSay("Sorry, something went wrong. Please try again later."), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
