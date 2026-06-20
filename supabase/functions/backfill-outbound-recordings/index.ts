import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authz: super_admin user JWT, service_role bearer, or cron secret
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const cronHeader = req.headers.get("x-cron-secret") || "";
    const { data: cronSecret } = await supabase.rpc("get_cron_secret");
    let authorized = false;
    if (bearer && bearer === SERVICE_KEY) authorized = true;
    if (!authorized && (bearer === cronSecret || cronHeader === cronSecret) && cronSecret) authorized = true;
    if (!authorized && bearer) {
      try {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: u } = await userClient.auth.getUser();
        if (u?.user?.id) {
          const { data: isSuper } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" });
          if (isSuper) authorized = true;
        }
      } catch (_e) { /* ignore */ }
    }
    if (!authorized) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // ------- 1. Backfill missing call_recording_url -------
    // Recordings on this project come from Retell (cloudfront.net), not Twilio.
    // For each lead missing a recording, fetch from Retell using retell_call_id; fall
    // back to Twilio Recordings API only if Retell can't provide one.
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY") || "";
    const { data: leads, error } = await supabase
      .from("outbound_leads")
      .select("id, twilio_call_sid, retell_call_id, call_duration_seconds, transcript")
      .is("call_recording_url", null)
      .not("twilio_call_sid", "is", null);
    if (error) throw error;

    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const results: any[] = [];
    for (const lead of leads || []) {
      const sid = (lead as any).twilio_call_sid as string;
      const retellId = (lead as any).retell_call_id as string | null;
      let recordingUrl: string | null = null;
      let duration: number | null = null;
      let transcript: string | null = null;
      let source: string = "none";

      // Try Retell first.
      if (retellId && RETELL_API_KEY) {
        const rr = await fetch(`https://api.retellai.com/v2/get-call/${retellId}`, {
          headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
        });
        if (rr.ok) {
          const rb = await rr.json();
          if (rb?.recording_url) {
            recordingUrl = rb.recording_url as string;
            source = "retell";
            if (rb.duration_ms) duration = Math.round((rb.duration_ms as number) / 1000);
            if (rb.transcript) transcript = rb.transcript as string;
          }
        } else {
          results.push({ lead: lead.id, retellId, retell_status: rr.status });
        }
      }

      // Fallback: Twilio
      if (!recordingUrl) {
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${sid}/Recordings.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        if (r.ok) {
          const body = await r.json();
          const rec = (body.recordings || [])[0];
          if (rec) {
            recordingUrl = `${SUPABASE_URL}/functions/v1/outbound-recording-proxy/${rec.sid}.mp3`;
            source = "twilio";
            if (rec.duration) duration = parseInt(rec.duration, 10) || null;
          }
        }
      }

      if (!recordingUrl) { results.push({ lead: lead.id, sid, recordings: 0, source }); continue; }

      const update: Record<string, unknown> = { call_recording_url: recordingUrl };
      if (duration && !(lead as any).call_duration_seconds) update.call_duration_seconds = duration;
      if (transcript && !(lead as any).transcript) update.transcript = transcript;
      const { error: upErr } = await supabase
        .from("outbound_leads")
        .update(update)
        .eq("id", lead.id);
      results.push({ lead: lead.id, sid, source, updated: !upErr, err: upErr?.message });
    }

    // ------- 2. Backfill missing campaign history events for recent calls -------
    // Any lead with a twilio_call_sid + campaign_id that has no call_placed event yet.
    const { data: callLeads } = await supabase
      .from("outbound_leads")
      .select("id, campaign_id, twilio_call_sid, business_name, first_name, phone_number, last_called_at, call_duration_seconds, status, retell_call_id")
      .not("twilio_call_sid", "is", null)
      .not("campaign_id", "is", null);

    const eventsBackfilled: any[] = [];
    for (const l of callLeads || []) {
      const { data: existing } = await supabase
        .from("outbound_campaign_events")
        .select("id")
        .eq("lead_id", (l as any).id)
        .eq("event_type", "call_placed")
        .limit(1);
      if (existing && existing.length > 0) continue;

      const label = (l as any).business_name || (l as any).first_name || (l as any).phone_number || "lead";
      const calledAt = (l as any).last_called_at || new Date().toISOString();

      // Insert call_placed at last_called_at (backdated).
      const { error: e1 } = await supabase.from("outbound_campaign_events").insert({
        campaign_id: (l as any).campaign_id,
        lead_id: (l as any).id,
        event_type: "call_placed",
        message: `Call placed to ${label} (${(l as any).phone_number || "?"})`,
        details: {
          twilio_sid: (l as any).twilio_call_sid,
          retell_call_id: (l as any).retell_call_id ?? null,
          backfilled: true,
        },
        created_at: calledAt,
      } as any);
      if (e1) { eventsBackfilled.push({ lead: (l as any).id, error: e1.message }); continue; }

      // Insert call_completed if we have a terminal-looking status.
      const terminal = ["interested", "not_interested", "demo_booked", "do_not_call", "no_answer"];
      if (terminal.includes((l as any).status)) {
        const dur = (l as any).call_duration_seconds || 0;
        const completedAt = new Date(new Date(calledAt).getTime() + Math.max(dur, 1) * 1000).toISOString();
        await supabase.from("outbound_campaign_events").insert({
          campaign_id: (l as any).campaign_id,
          lead_id: (l as any).id,
          event_type: "call_completed",
          message: `Call to ${label} completed${dur ? ` (${dur}s)` : ""}`,
          details: {
            twilio_sid: (l as any).twilio_call_sid,
            duration_seconds: dur || null,
            final_status: (l as any).status,
            backfilled: true,
          },
          created_at: completedAt,
        } as any);
      }
      eventsBackfilled.push({ lead: (l as any).id, ok: true });
    }

    return new Response(JSON.stringify({
      ok: true,
      recordings_processed: results.length,
      recordings: results,
      events_backfilled: eventsBackfilled.length,
      events: eventsBackfilled,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backfill-outbound-recordings] error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
