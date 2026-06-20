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

  function formatPhone(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith("+44") && trimmed.length === 13) {
      const rest = trimmed.slice(3);
      return "0" + rest.slice(0, 4) + " " + rest.slice(4);
    }
    return trimmed;
  }

  const body =
    `Hi ${firstName}, I tried calling ${businessName} earlier. I'm Aria from Aivia we've built an AI receptionist that answers every call your team misses, takes bookings and sends confirmations automatically, 24/7. ` +
    `Most businesses lose over a third of their calls while busy and those people rarely call back. Worth a quick chat with Mo? Call ${formatPhone(opts.moPhone)} or visit aiviaapp.co.uk`;

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

    // Verify Twilio signature
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    const signature = req.headers.get("x-twilio-signature");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    const publicUrl = `${proto}://${host}${new URL(req.url).pathname}`;
    const ok = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature);
    if (!ok) {
      console.warn("[twilio-outbound-status] invalid Twilio signature");
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const callSid = params.CallSid;
    const status = params.CallStatus;
    const durationStr = params.CallDuration;
    const answeredBy = params.AnsweredBy || "";
    if (!callSid) return new Response("ok", { headers: corsHeaders });


    const { data: lead } = await supabase
      .from("outbound_leads")
      .select("id, campaign_id, retry_count, status, first_name, business_name, phone_number, sms_sent")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    if (!lead) return new Response("ok", { headers: corsHeaders });

    const isMachine = answeredBy.startsWith("machine_") || answeredBy === "fax";
    const isNoAnswer = status === "no-answer" || status === "busy" || status === "failed" || isMachine;

    console.info(`[twilio-outbound-status] lead=${lead.id} status=${status} answered_by=${answeredBy || "-"} is_machine=${isMachine}`);

    const update: Record<string, unknown> = {};
    if (isNoAnswer) {
      if (!["interested", "demo_booked", "not_interested", "do_not_call"].includes(lead.status)) {
        update.status = "no_answer";
      }
      if (status === "no-answer" || status === "busy" || status === "failed" || status === "completed") {
        update.retry_count = (lead.retry_count || 0) + 1;
      }
    }
    if (status === "completed") {
      update.last_called_at = new Date().toISOString();
      if (durationStr) update.call_duration_seconds = parseInt(durationStr, 10) || null;
    }
    if (Object.keys(update).length) await supabase.from("outbound_leads").update(update).eq("id", lead.id);

    // Log call completion to campaign history (terminal Twilio statuses only)
    if ((lead as any).campaign_id && (status === "completed" || status === "no-answer" || status === "busy" || status === "failed")) {
      const label = lead.business_name || lead.first_name || lead.phone_number || "lead";
      const durSec = durationStr ? parseInt(durationStr, 10) || 0 : 0;
      await supabase.rpc("log_campaign_event", {
        p_campaign_id: (lead as any).campaign_id,
        p_event_type: "call_completed",
        p_message:
          status === "completed"
            ? `Call to ${label} completed${durSec ? ` (${durSec}s)` : ""}${isMachine ? " — voicemail" : ""}`
            : `Call to ${label} ${status}${isMachine ? " (voicemail)" : ""}`,
        p_lead_id: lead.id,
        p_details: {
          twilio_status: status,
          answered_by: answeredBy || null,
          duration_seconds: durSec || null,
          is_machine: isMachine,
        },
      });
    }


    // Auto SMS follow-up after a no-answer.
    if (isNoAnswer) {
      if ((lead as any).sms_sent) {
        console.info(`[twilio-outbound-status] SMS skipped lead=${lead.id} reason=already_sent status=${status}`);
      } else if (!lead.phone_number) {
        console.warn(`[twilio-outbound-status] SMS skipped lead=${lead.id} reason=no_phone_number`);
      } else {
        const { data: settings } = await supabase
          .from("outbound_settings")
          .select("sms_sender_id, mo_phone_number")
          .limit(1)
          .maybeSingle();
        const senderId = ((settings as any)?.sms_sender_id || "Aivia").trim() || "Aivia";
        const moPhone = (settings as any)?.mo_phone_number;
        if (!moPhone) {
          console.warn(`[twilio-outbound-status] SMS skipped lead=${lead.id} reason=missing_mo_phone_number`);
        } else {
          console.info(`[twilio-outbound-status] sending SMS lead=${lead.id} to=${lead.phone_number} from=${senderId} status=${status}`);
          const ok = await sendFollowUpSms({
            to: lead.phone_number,
            from: senderId,
            firstName: lead.first_name || "",
            businessName: lead.business_name || "",
            moPhone,
          });
          if (ok) {
            console.info(`[twilio-outbound-status] SMS sent lead=${lead.id}`);
            await supabase.from("outbound_leads").update({ sms_sent: true }).eq("id", lead.id);
          }
        }
      }
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("[twilio-outbound-status] error", e);
    return new Response("ok", { headers: corsHeaders });
  }
});
