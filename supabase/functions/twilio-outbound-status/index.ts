import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

async function sendFollowUpSms(opts: {
  to: string;
  from: string;
  firstName: string;
  businessName: string;
  moPhone: string;
}) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    console.error("[twilio-outbound-status] missing Twilio credentials");
    return false;
  }
  const firstName = (opts.firstName || "there").trim() || "there";
  const businessName = (opts.businessName || "your business").trim() || "your business";
  const body =
    `Hi ${firstName}, I tried calling you earlier about how ${businessName} could stop missing calls while the team is busy. ` +
    `Most businesses miss more than they realise — happy to show you how to fix it. ` +
    `Call me back on ${opts.moPhone} or visit aiviaapp.co.uk — Mo from Aivia`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: opts.to, From: opts.from, Body: body });
  const auth = btoa(`${accountSid}:${authToken}`);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!r.ok) {
    console.error("[twilio-outbound-status] SMS send failed", r.status, await r.text());
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = v.toString();

    const callSid = params.CallSid;
    const status = params.CallStatus;
    const durationStr = params.CallDuration;
    if (!callSid) return new Response("ok", { headers: corsHeaders });

    const { data: lead } = await supabase
      .from("outbound_leads")
      .select("id, retry_count, status, first_name, business_name, phone_number, sms_sent")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    if (!lead) return new Response("ok", { headers: corsHeaders });

    const update: Record<string, unknown> = {};
    const isNoAnswer = status === "no-answer" || status === "busy" || status === "failed";
    if (isNoAnswer) {
      if (!["interested", "demo_booked", "not_interested", "do_not_call"].includes(lead.status)) {
        update.status = "no_answer";
      }
      update.retry_count = (lead.retry_count || 0) + 1;
    }
    if (status === "completed") {
      update.last_called_at = new Date().toISOString();
      if (durationStr) update.call_duration_seconds = parseInt(durationStr, 10) || null;
    }
    if (Object.keys(update).length) await supabase.from("outbound_leads").update(update).eq("id", lead.id);

    // Auto SMS follow-up after a no-answer when at least one prior attempt was made.
    if (isNoAnswer && (lead.retry_count || 0) > 0 && !(lead as any).sms_sent && lead.phone_number) {
      const { data: settings } = await supabase
        .from("outbound_settings")
        .select("from_number, mo_phone_number")
        .limit(1)
        .maybeSingle();
      const fromNumber = (settings as any)?.from_number;
      const moPhone = (settings as any)?.mo_phone_number;
      if (fromNumber && moPhone) {
        const ok = await sendFollowUpSms({
          to: lead.phone_number,
          from: fromNumber,
          firstName: lead.first_name || "",
          businessName: lead.business_name || "",
          moPhone,
        });
        if (ok) {
          await supabase.from("outbound_leads").update({ sms_sent: true }).eq("id", lead.id);
        }
      } else {
        console.warn("[twilio-outbound-status] skipping SMS — missing from_number or mo_phone_number");
      }
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("[twilio-outbound-status] error", e);
    return new Response("ok", { headers: corsHeaders });
  }
});
