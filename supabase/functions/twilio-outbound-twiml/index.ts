const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead_id") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const host = new URL(SUPABASE_URL).hostname;
  // Dedicated outbound media stream — runs the AI sales prompt with lead context.
  const mediaStreamUrl = `wss://${host}/functions/v1/twilio-outbound-media-stream`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(mediaStreamUrl)}">
      <Parameter name="call_type" value="outbound"/>
      <Parameter name="lead_id" value="${escapeXml(leadId)}"/>
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
});
