import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const windowMs = 30 * 60 * 1000;
    const windowStart = new Date(proposed.getTime() - windowMs).toISOString();
    const windowEnd = new Date(proposed.getTime() + windowMs).toISOString();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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
        JSON.stringify({ available: false, conflict: data[0].demo_datetime }),
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
