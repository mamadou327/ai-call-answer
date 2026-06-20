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

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backfill-outbound-recordings] error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
