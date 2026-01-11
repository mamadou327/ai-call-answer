import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// ============================================================================
// TWILIO SIGNATURE VALIDATION
// ============================================================================

async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    console.error("[StreamAction] No X-Twilio-Signature header provided");
    return false;
  }

  try {
    // Sort params alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + params[key];
    }

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const data = encoder.encode(dataString);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignature = encodeBase64(new Uint8Array(signatureBuffer));

    const isValid = expectedSignature === signature;
    if (!isValid) {
      console.error(
        "[StreamAction] Signature mismatch. Expected:",
        expectedSignature,
        "Got:",
        signature
      );
    }
    return isValid;
  } catch (error) {
    console.error("[StreamAction] Error validating signature:", error);
    return false;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeDialNumber(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  if (trimmed.startsWith("0") && digits.length === 11) return `+44${digits.slice(1)}`;
  if (digits.startsWith("44") && digits.length === 12) return `+${digits}`;

  return `+${digits}`;
}

// Maximum reconnect attempts before giving up
const MAX_RECONNECTS = 2;

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
    const reconnectCount = parseInt(url.searchParams.get("reconnect") || "0", 10);

    console.log("[StreamAction] Called for token:", token?.substring(0, 8) + "...", "callSid:", callSid, "reconnectCount:", reconnectCount);

    // Parse form data if present (Twilio sends POST with form data)
    const params: Record<string, string> = {};
    try {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        params[key] = value.toString();
      }
    } catch {
      // Form data may not be present, that's okay
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Twilio signature for security
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      // Build full URL with query params for signature validation (include reconnect count)
      const publicUrl = `${supabaseUrl}/functions/v1/twilio-stream-action/${token}?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(fromNumber)}&reconnect=${reconnectCount}`;
      
      console.log("[StreamAction] Validating signature with URL:", publicUrl);
      
      const isValid = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature);
      
      if (!isValid) {
        console.error("[StreamAction] Invalid Twilio signature - request rejected");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">Security validation failed. Goodbye.</Say>
  <Hangup/>
</Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
      
      console.log("[StreamAction] Signature validated successfully");
    } else {
      console.warn("[StreamAction] TWILIO_AUTH_TOKEN not configured - skipping signature validation");
    }

    // Check if there's a pending transfer for this call
    const { data: conversation } = await supabase
      .from("call_conversations")
      .select("id, status, messages")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (conversation && conversation.status === "transfer_pending") {
      const messages = conversation.messages as any[];
      const transferInfo = messages?.find((m: any) => m.type === "transfer_request");

      if (transferInfo) {
        // Use business Twilio number as callerId (not the customer's number)
        const { data: business } = await supabase
          .from("businesses")
          .select("twilio_phone_number")
          .eq("twilio_webhook_token", token)
          .maybeSingle();

        const callerId = business?.twilio_phone_number
          ? normalizeDialNumber(business.twilio_phone_number)
          : "";

        const callerIdAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
        const dialTo = normalizeDialNumber(transferInfo.transfer_to);

        console.log("[StreamAction] Processing transfer to:", dialTo);

        // Update conversation status
        await supabase
          .from("call_conversations")
          .update({ status: "transferred" })
          .eq("id", conversation.id);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerIdAttr} timeout="30">
    <Number>${escapeXml(dialTo)}</Number>
  </Dial>
  <Say voice="Polly.Amy-Neural" language="en-GB">Sorry, they're unavailable. Goodbye.</Say>
  <Hangup/>
</Response>`;

        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    // No transfer pending - check if we should attempt reconnect
    if (reconnectCount < MAX_RECONNECTS) {
      console.log(`[StreamAction] No transfer, attempting reconnect (${reconnectCount + 1}/${MAX_RECONNECTS})`);
      
      // Get business info to rebuild stream URL
      const { data: business } = await supabase
        .from("businesses")
        .select("twilio_phone_number")
        .eq("twilio_webhook_token", token)
        .maybeSingle();

      // Build new stream action URL with incremented reconnect count
      const nextReconnect = reconnectCount + 1;
      const newStreamActionUrl = `${supabaseUrl}/functions/v1/twilio-stream-action/${token}?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(fromNumber)}&reconnect=${nextReconnect}`;
      const mediaStreamUrl = `wss://${new URL(supabaseUrl).hostname}/functions/v1/twilio-media-stream/${token}`;
      const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback/${token}`;
      
      // Log reconnect attempt to conversation
      if (conversation) {
        const messages = (conversation.messages as any[]) || [];
        messages.push({
          role: "system",
          content: `[reconnect] Stream reconnecting (attempt ${nextReconnect}/${MAX_RECONNECTS})`,
          timestamp: new Date().toISOString(),
        });
        await supabase
          .from("call_conversations")
          .update({ messages })
          .eq("id", conversation.id);
      }
      
      // Return TwiML to restart the stream with a brief pause
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Connect action="${escapeXml(newStreamActionUrl)}">
    <Stream url="${escapeXml(mediaStreamUrl)}">
      <Parameter name="callerPhone" value="${escapeXml(fromNumber)}"/>
      <Parameter name="callSid" value="${escapeXml(callSid)}"/>
      <Parameter name="recordingCallbackUrl" value="${escapeXml(recordingCallbackUrl)}"/>
      <Parameter name="isReconnect" value="true"/>
      <Parameter name="reconnectCount" value="${nextReconnect}"/>
    </Stream>
  </Connect>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }
    
    // Max reconnects reached - end the call gracefully
    console.log("[StreamAction] Max reconnects reached, ending call");
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">We're experiencing technical difficulties. Please call back in a moment. Goodbye.</Say>
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
