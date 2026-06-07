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
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = v.toString();

    const callSid = params.CallSid;
    const status = params.CallStatus;
    const durationStr = params.CallDuration;
    if (!callSid) return new Response("ok", { headers: corsHeaders });

    const { data: lead } = await supabase
      .from("outbound_leads")
      .select("id, retry_count, status")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    if (!lead) return new Response("ok", { headers: corsHeaders });

    const update: Record<string, unknown> = {};
    if (status === "no-answer" || status === "busy" || status === "failed") {
      // Only downgrade to no_answer if no other final outcome (e.g. demo_booked) is set yet.
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
    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("[twilio-outbound-status] error", e);
    return new Response("ok", { headers: corsHeaders });
  }
});
