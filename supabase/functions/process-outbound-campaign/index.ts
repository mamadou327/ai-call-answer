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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { day, hour } = londonNowParts();
    const startOfDayISO = londonStartOfDayISO();

    const { data: campaigns } = await supabase
      .from("outbound_campaigns")
      .select("*")
      .eq("status", "active");

    const summary: Record<string, unknown>[] = [];

    for (const c of campaigns || []) {
      if (!c.calling_days?.includes(day)) {
        summary.push({ id: c.id, skipped: "day_not_allowed", day }); continue;
      }
      if (hour < c.calling_start_hour || hour >= c.calling_end_hour) {
        summary.push({ id: c.id, skipped: "outside_hours", hour }); continue;
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
        .order("created_at", { ascending: true })
        .limit(remainingCap);

      let placed = 0;
      for (const l of leads || []) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/twilio-outbound-call`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ lead_id: l.id }),
          });
          if (!r.ok) console.error("[process-outbound-campaign] call failed", await r.text());
          placed++;
        } catch (e) {
          console.error("[process-outbound-campaign] call error", e);
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
