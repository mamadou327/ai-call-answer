import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function londonNowParts(): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const day = parts.find((p) => p.type === "weekday")?.value || "";
  const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
  return { day, hour: parseInt(hourStr, 10) % 24 };
}

function londonStartOfDayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const ymd = fmt.format(new Date()); // YYYY-MM-DD
  // London midnight in UTC ≈ that date 00:00 in London; subtract offset by formatting back
  // Simplification: use UTC midnight of the London date — close enough for daily caps over short windows.
  return `${ymd}T00:00:00Z`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Cron auth: accept x-cron-secret header or Authorization: Bearer <secret>
    const headerSecret = req.headers.get("x-cron-secret") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = headerSecret || bearerSecret;
    const { data: cronSecret } = await supabase.rpc("get_cron_secret");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let isAuthorized =
      (provided && cronSecret && provided === cronSecret) ||
      (bearerSecret && bearerSecret === serviceKey);

    // Also accept an authenticated super_admin user JWT (used by the in-app Play button)
    if (!isAuthorized && bearerSecret) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: `Bearer ${bearerSecret}` } } },
        );
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user?.id) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: userData.user.id,
            _role: "super_admin",
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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Optional body: { campaign_id?: string, force?: boolean, activate?: boolean }
    // activate is used by the in-app Play button: only mark active after schedule checks pass.
    let body: { campaign_id?: string; force?: boolean; activate?: boolean } = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json();
      }
    } catch (_e) { /* ignore */ }

    const { day, hour } = londonNowParts();
    const startOfDayISO = londonStartOfDayISO();

    let q = supabase.from("outbound_campaigns").select("*").is("archived_at", null);
    if (body.campaign_id) q = q.eq("id", body.campaign_id).neq("status", "completed");
    else q = q.eq("status", "active");
    const { data: campaigns } = await q;

    const summary: Record<string, unknown>[] = [];

    for (const c of campaigns || []) {
      if (!body.force && !c.calling_days?.includes(day)) {
        summary.push({ id: c.id, skipped: "day_not_allowed", day }); continue;
      }
      if (!body.force && (hour < c.calling_start_hour || hour >= c.calling_end_hour)) {
        summary.push({ id: c.id, skipped: "outside_hours", hour }); continue;
      }

      if (body.activate && c.status !== "active") {
        const { error: activateError } = await supabase
          .from("outbound_campaigns")
          .update({ status: "active" })
          .eq("id", c.id);
        if (activateError) {
          summary.push({ id: c.id, skipped: "activate_failed", error: activateError.message });
          continue;
        }
      }

      // Count calls placed today (London-day approximation)
      const { count: todayCount } = await supabase
        .from("outbound_leads")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .gte("last_called_at", startOfDayISO);

      if ((todayCount || 0) >= c.calls_per_day_limit) {
        summary.push({ id: c.id, skipped: "daily_cap", todayCount }); continue;
      }

      const remainingCap = c.calls_per_day_limit - (todayCount || 0);
      // Pull up to remainingCap pending leads, but throttle by delay_between_calls_seconds.
      const { data: leads } = await supabase
        .from("outbound_leads")
        .select("id")
        .eq("campaign_id", c.id)
        .eq("status", "pending")
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(remainingCap);

      let placed = 0;
      for (const l of leads || []) {
        // Atomically claim the lead so concurrent invocations (cron + manual Play, overlapping ticks)
        // cannot dial the same lead twice. Only one updater will get a row back.
        const { data: claimed, error: claimErr } = await supabase
          .from("outbound_leads")
          .update({ status: "calling", last_called_at: new Date().toISOString() })
          .eq("id", l.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed) {
          console.info(`[process-outbound-campaign] skip lead ${l.id} — already claimed by another run`);
          continue;
        }
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/twilio-outbound-call`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ lead_id: l.id }),
          });
          if (!r.ok) {
            console.error("[process-outbound-campaign] call failed", await r.text());
            // Release the claim so it can be retried on the next tick
            await supabase.from("outbound_leads").update({ status: "pending" }).eq("id", l.id).eq("status", "calling");
          }
          placed++;
        } catch (e) {
          console.error("[process-outbound-campaign] call error", e);
          await supabase.from("outbound_leads").update({ status: "pending" }).eq("id", l.id).eq("status", "calling");
        }
        if (placed < (leads?.length || 0)) await sleep((c.delay_between_calls_seconds || 30) * 1000);
      }
      summary.push({ id: c.id, placed });
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[process-outbound-campaign] error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
