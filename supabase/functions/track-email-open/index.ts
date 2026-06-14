import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent PNG
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const pngResponse = () =>
  new Response(PNG, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/png",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return pngResponse();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: log } = await supabase
      .from("outbound_email_log")
      .select("id, lead_id, step_number, opened_at")
      .eq("id", id)
      .maybeSingle();

    if (log) {
      const now = new Date().toISOString();
      if (!log.opened_at) {
        await supabase.from("outbound_email_log").update({ opened_at: now }).eq("id", id);
      }
      if (log.lead_id && log.step_number && [1, 2, 3].includes(log.step_number)) {
        const openedCol = `email${log.step_number}_opened_at`;
        const statusCol = `email${log.step_number}_status`;
        const { data: lead } = await supabase
          .from("outbound_leads")
          .select(`id, ${openedCol}, ${statusCol}`)
          .eq("id", log.lead_id)
          .maybeSingle();
        const update: any = {};
        if (lead && !(lead as any)[openedCol]) update[openedCol] = now;
        // forward-only: pending/sent -> opened
        if (lead && ((lead as any)[statusCol] === "sent" || (lead as any)[statusCol] === "pending")) {
          update[statusCol] = "opened";
        }
        if (Object.keys(update).length) {
          await supabase.from("outbound_leads").update(update).eq("id", log.lead_id);
        }
      }
    }
  } catch (e) {
    console.error("[track-email-open] error", e);
  }

  return pngResponse();
});
