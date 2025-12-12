import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];
    const callSid = url.searchParams.get("callSid") || "";
    const fromNumber = url.searchParams.get("from") || "";

    console.log("[StreamAction] Called for token:", token?.substring(0, 8) + "...", "callSid:", callSid);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if there's a pending transfer for this call
    const { data: conversation } = await supabase
      .from("call_conversations")
      .select("id, status, messages")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (conversation && conversation.status === "transfer_pending") {
      // Get transfer details from messages (last message should have transfer info)
      const messages = conversation.messages as any[];
      const transferInfo = messages?.find((m: any) => m.type === "transfer_request");
      
      if (transferInfo) {
        console.log("[StreamAction] Processing transfer to:", transferInfo.transfer_to);
        
        // Update conversation status
        await supabase
          .from("call_conversations")
          .update({ status: "transferred" })
          .eq("id", conversation.id);

        // Return TwiML to dial the staff member
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">Please hold while I transfer you to ${escapeXml(transferInfo.staff_name || "our team member")}.</Say>
  <Dial callerId="${escapeXml(fromNumber)}" timeout="30">
    <Number>${escapeXml(transferInfo.transfer_to)}</Number>
  </Dial>
  <Say voice="Polly.Amy-Neural" language="en-GB">I'm sorry, they are not available right now. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;

        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    // No transfer pending - just hang up gracefully
    console.log("[StreamAction] No pending transfer, ending call");
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("[StreamAction] Error:", error);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">We're experiencing technical difficulties. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
