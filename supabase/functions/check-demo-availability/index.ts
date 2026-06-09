import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TZ = "Europe/London";

function getLondonParts(date: Date): { weekday: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0;
  return { weekday, hour };
}

function formatHour12(h: number): string {
  const period = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { demo_datetime } = await req.json();
    if (!demo_datetime || typeof demo_datetime !== "string") {
      return new Response(
        JSON.stringify({ error: "demo_datetime (ISO 8601 string) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const proposed = new Date(demo_datetime);
    if (isNaN(proposed.getTime())) {
      return new Response(
        JSON.stringify({ error: "demo_datetime is not a valid ISO 8601 datetime" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch availability settings
    const { data: settings } = await supabase
      .from("outbound_settings")
      .select("demo_available_days, demo_start_hour, demo_end_hour")
      .limit(1)
      .maybeSingle();

    const availableDays: string[] = settings?.demo_available_days ?? [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ];
    const startHour: number = settings?.demo_start_hour ?? 9;
    const endHour: number = settings?.demo_end_hour ?? 18;

    const { weekday, hour } = getLondonParts(proposed);

    if (!availableDays.includes(weekday)) {
      return new Response(
        JSON.stringify({
          available: false,
          reason: "day_unavailable",
          message: "Mo is not available on that day",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hour < startHour || hour >= endHour) {
      return new Response(
        JSON.stringify({
          available: false,
          reason: "outside_hours",
          message: `Mo is only available between ${formatHour12(startHour)} and ${formatHour12(endHour)}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const windowMs = 30 * 60 * 1000;
    const windowStart = new Date(proposed.getTime() - windowMs).toISOString();
    const windowEnd = new Date(proposed.getTime() + windowMs).toISOString();

    const { data, error } = await supabase
      .from("outbound_demos")
      .select("demo_datetime")
      .eq("status", "scheduled")
      .gte("demo_datetime", windowStart)
      .lte("demo_datetime", windowEnd)
      .order("demo_datetime", { ascending: true })
      .limit(1);

    if (error) {
      console.error("[check-demo-availability] query error", error);
      return new Response(
        JSON.stringify({ error: "query_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data && data.length > 0) {
      return new Response(
        JSON.stringify({ available: false, reason: "conflict", conflict: data[0].demo_datetime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ available: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[check-demo-availability] error", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
