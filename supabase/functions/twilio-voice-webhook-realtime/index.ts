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
    console.error("[VoiceWebhookRT] No X-Twilio-Signature header provided");
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
      console.error("[VoiceWebhookRT] Signature mismatch. Expected:", expectedSignature, "Got:", signature);
    }
    return isValid;
  } catch (error) {
    console.error("[VoiceWebhookRT] Error validating signature:", error);
    return false;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlError(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

async function tryStartTwilioCallRecording(opts: {
  callSid: string;
  recordingStatusCallbackUrl: string;
}): Promise<void> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!opts.callSid) {
    console.warn("[VoiceWebhookRT] No CallSid - cannot start recording");
    return;
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    console.warn("[VoiceWebhookRT] Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN - cannot start recording");
    return;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${opts.callSid}/Recordings.json`;
  const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

  console.log("[VoiceWebhookRT] Starting call recording via Twilio API:", {
    callSid: opts.callSid,
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        RecordingStatusCallback: opts.recordingStatusCallbackUrl,
        RecordingStatusCallbackMethod: "POST",
        RecordingStatusCallbackEvent: "completed",
      }),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      console.error(
        "[VoiceWebhookRT] Failed to start recording:",
        res.status,
        bodyText
      );
      return;
    }

    console.log("[VoiceWebhookRT] Recording started successfully:", bodyText);
  } catch (error) {
    console.error("[VoiceWebhookRT] Error starting recording:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[VoiceWebhookRT] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-webhook-realtime") {
      return twimlError("This number is not configured correctly. Goodbye.");
    }

    // Parse Twilio parameters
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Twilio signature for security
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      const publicUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook-realtime/${token}`;
      
      console.log("[VoiceWebhookRT] Validating signature with URL:", publicUrl);
      
      const isValid = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature);
      
      if (!isValid) {
        console.error("[VoiceWebhookRT] Invalid Twilio signature - request rejected");
        return twimlError("Security validation failed. Goodbye.");
      }
      
      console.log("[VoiceWebhookRT] Signature validated successfully");
    } else {
      console.warn("[VoiceWebhookRT] TWILIO_AUTH_TOKEN not configured - skipping signature validation");
    }

    const fromNumber = params.From || params.Caller || "";
    const toNumber = params.To || params.Called || "";
    const callSid = params.CallSid || "";
    const callerName = params.CallerName || null;

    console.log("[VoiceWebhookRT] Call details:", { from: fromNumber, to: toNumber, callSid });

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_enabled, aivia_active")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[VoiceWebhookRT] Business not found");
      return twimlError("This number is not configured. Goodbye.");
    }

    if (!business.twilio_enabled || !business.aivia_active) {
      return twimlError(`Thank you for calling ${business.business_name}. We're currently unavailable. Please try again later.`);
    }

    // Check if caller is blocked
    const normalizedCaller = fromNumber.replace(/\D/g, "").slice(-10);
    const { data: blockedCustomer } = await supabase
      .from("customers")
      .select("id, is_blocked")
      .eq("business_id", business.id)
      .eq("is_blocked", true)
      .or(`phone.ilike.%${normalizedCaller}%,phone.eq.${fromNumber}`)
      .maybeSingle();

    if (blockedCustomer) {
      console.log("[VoiceWebhookRT] Blocked caller:", fromNumber);
      return twimlError("I'm sorry, we're unable to take bookings from this number. Goodbye.");
    }

    // Log the call
    await supabase.from("calls_log").insert({
      business_id: business.id,
      caller_phone: fromNumber,
      caller_name: callerName,
      call_type: "other",
      call_outcome: "in_progress",
      twilio_call_sid: callSid,
      to_number: toNumber,
      provider: "twilio",
    });

    // Create conversation record
    await supabase.from("call_conversations").insert({
      call_sid: callSid,
      business_id: business.id,
      caller_phone: fromNumber,
      caller_name: callerName,
      messages: [],
      status: "active",
    });

    // Build Media Stream URL
    const mediaStreamUrl = `wss://${new URL(supabaseUrl).hostname}/functions/v1/twilio-media-stream/${token}`;

    // Build action URL for when stream ends (used for transfers)
    const streamActionUrl = `${supabaseUrl}/functions/v1/twilio-stream-action/${token}?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(fromNumber)}`;

    // Recording callback URL (stores recording in backend storage and links it to calls_log)
    const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback/${token}`;

    await tryStartTwilioCallRecording({
      callSid,
      recordingStatusCallbackUrl: recordingCallbackUrl,
    });

    console.log("[VoiceWebhookRT] Starting media stream to:", mediaStreamUrl);

    // Return TwiML with Media Stream - the action URL is called when the stream ends
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="${escapeXml(streamActionUrl)}">
    <Stream url="${escapeXml(mediaStreamUrl)}">
      <Parameter name="callerPhone" value="${escapeXml(fromNumber)}"/>
      <Parameter name="callSid" value="${escapeXml(callSid)}"/>
    </Stream>
  </Connect>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("[VoiceWebhookRT] Error:", error);
    return twimlError("We're experiencing technical difficulties. Please try again later.");
  }
});
