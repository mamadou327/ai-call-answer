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
  const callId = url.searchParams.get("call_id") || "";

  const sipUri = `sip:${callId}@5t4n6j0wnrl.sip.livekit.cloud`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
</Response>`;

  return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
});
