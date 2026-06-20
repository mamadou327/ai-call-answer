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

    // ------- 1. Backfill missing call_recording_url from Twilio -------
    const { data: leads, error } = await supabase
      .from("outbound_leads")
      .select("id, twilio_call_sid")
      .is("call_recording_url", null)
      .not("twilio_call_sid", "is", null);
    if (error) throw error;

    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const results: any[] = [];
    for (const lead of leads || []) {
      const sid = (lead as any).twilio_call_sid as string;
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${sid}/Recordings.json`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (!r.ok) { results.push({ lead: lead.id, sid, status: r.status, error: await r.text() }); continue; }
      const body = await r.json();
      const rec = (body.recordings || [])[0];
      if (!rec) { results.push({ lead: lead.id, sid, recordings: 0 }); continue; }
      const proxyUrl = `${SUPABASE_URL}/functions/v1/outbound-recording-proxy/${rec.sid}.mp3`;
      const update: Record<string, unknown> = { call_recording_url: proxyUrl };
      if (rec.duration) update.call_duration_seconds = parseInt(rec.duration, 10) || null;
      const { error: upErr } = await supabase
        .from("outbound_leads")
        .update(update)
        .eq("id", lead.id);
      results.push({ lead: lead.id, sid, recordingSid: rec.sid, updated: !upErr, err: upErr?.message });
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
