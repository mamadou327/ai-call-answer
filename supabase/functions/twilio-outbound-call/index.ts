import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getTimeOfDay = (): string => {
  const hour = parseInt(new Date().toLocaleString("en-GB", {
    timeZone: "Europe/London", hour: "numeric", hour12: false
  }));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY");
    if (!RETELL_API_KEY) {
      return new Response(JSON.stringify({ error: "RETELL_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: cron secret, service role bearer, or super_admin user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const headerSecret = req.headers.get("x-cron-secret") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = headerSecret || bearer;
    const { data: cronSecret } = await supabase.rpc("get_cron_secret");
    let isAuthorized =
      (provided && cronSecret && provided === cronSecret) ||
      (bearer && bearer === SERVICE_KEY);
    if (!isAuthorized && bearer) {
      try {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: u } = await userClient.auth.getUser();
        if (u?.user?.id) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: u.user.id, _role: "super_admin",
          });
          if (isAdmin) isAuthorized = true;
        }
      } catch (_e) { /* ignore */ }
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: corsHeaders });
    }


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
      .select("from_number, retell_agent_id")
      .limit(1)
      .maybeSingle();

    const fromNumber = settings?.from_number;
    const retellAgentId = (settings as any)?.retell_agent_id;

    if (!fromNumber) {
      return new Response(JSON.stringify({ error: "No outbound from_number configured in outbound_settings" }), { status: 400, headers: corsHeaders });
    }
    if (!retellAgentId) {
      return new Response(JSON.stringify({ error: "No retell_agent_id configured in outbound_settings (Retell Settings tab)" }), { status: 400, headers: corsHeaders });
    }

    const firstName = lead.first_name?.trim() || "";
    const has_name = firstName && firstName.length > 0 ? "true" : "false";

    const phone = lead.phone_number || "";
    const is_mobile = (
      phone.startsWith("07") ||
      phone.startsWith("+447") ||
      phone.startsWith("447")
    ) ? "true" : "false";

    const timeOfDay = getTimeOfDay();

    let open_with: string;
    if (has_name === "true" && is_mobile === "true") {
      open_with = `Hi ${firstName}, good ${timeOfDay} — hope I am not catching you at a bad time.`;
    } else if (has_name === "true" && is_mobile === "false") {
      open_with = `Hi there, could I speak with ${firstName} please?`;
    } else {
      open_with = `Hi there, sorry to bother you — is the owner or manager around?`;
    }

    const businessName = lead.business_name || "your business";
    const businessType = (lead as any).business_type && String((lead as any).business_type).trim()
      ? String((lead as any).business_type).trim()
      : "service business";
    const now = new Date();

    const formatSpokenDate = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);

    const currentDate = formatSpokenDate(now);

    const next7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i + 1);
      const day = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long" });
      const date = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric" });
      const month = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "long" });
      return `${day} = ${date} ${month}`;
    }).join(", ");

    // Step 1: register the call with Retell
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
          has_name: has_name,
          business_name: businessName,
          current_date: currentDate,
          business_type: businessType,
          next_7_days: next7Days,
          is_mobile: is_mobile,
          open_with: open_with,
          time_of_day: timeOfDay,
        },
      }),
    });
    const retellData = await retellRes.json();
    if (!retellRes.ok || !retellData?.call_id) {
      console.error("[twilio-outbound-call] Retell register error", retellRes.status, retellData);
      return new Response(JSON.stringify({ error: "retell_register_failed", detail: retellData }), { status: 500, headers: corsHeaders });
    }
    const retellCallId: string = retellData.call_id;

    await supabase.from("outbound_leads").update({ retell_call_id: retellCallId } as any).eq("id", lead_id);

    // Step 2: dial via Twilio, pointing at TwiML that bridges to Retell SIP
    const base = SUPABASE_URL;
    const twimlUrl = `${base}/functions/v1/twilio-outbound-twiml?call_id=${encodeURIComponent(retellCallId)}&lead_id=${encodeURIComponent(lead_id)}`;
    const statusUrl = `${base}/functions/v1/twilio-outbound-status`;

    const body = new URLSearchParams({
      To: lead.phone_number,
      From: fromNumber,
      Url: twimlUrl,
      StatusCallback: statusUrl,
      StatusCallbackMethod: "POST",
      // Answering Machine Detection — async so it doesn't delay call connect.
      // AnsweredBy will be delivered on the status callback (machine_start, fax, human, unknown, etc.)
      MachineDetection: "DetectMessageEnd",
      AsyncAmd: "true",
      AsyncAmdStatusCallback: statusUrl,
      AsyncAmdStatusCallbackMethod: "POST",
    });
    // NOTE: Twilio-side recording intentionally disabled. Retell records on its side and
    // sends the recording URL back via call_analyzed. Twilio's recording plays a start beep.
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

    if (lead.campaign_id) {
      const label = lead.business_name || lead.first_name || lead.phone_number || "lead";
      await supabase.rpc("log_campaign_event", {
        p_campaign_id: lead.campaign_id,
        p_event_type: "call_placed",
        p_message: `Call placed to ${label} (${lead.phone_number})`,
        p_lead_id: lead_id,
        p_details: { twilio_sid: data.sid, retell_call_id: retellCallId, voice: (settings as any)?.voice ?? null },
      });
    }


    return new Response(JSON.stringify({ ok: true, sid: data.sid, retell_call_id: retellCallId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[twilio-outbound-call] error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
