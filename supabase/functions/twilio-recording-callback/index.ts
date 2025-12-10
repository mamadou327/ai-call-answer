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
    console.error("[RecordingCallback] No X-Twilio-Signature header provided");
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
      console.error("[RecordingCallback] Signature mismatch");
    }
    return isValid;
  } catch (error) {
    console.error("[RecordingCallback] Error validating signature:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[RecordingCallback] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-recording-callback") {
      console.error("[RecordingCallback] No token provided");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Parse Twilio parameters from request body
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate Twilio signature
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      const fullUrl = req.url;
      
      const isValid = await validateTwilioSignature(twilioAuthToken, fullUrl, params, signature);
      if (!isValid) {
        console.error("[RecordingCallback] Invalid Twilio signature - rejecting request");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      console.log("[RecordingCallback] Twilio signature validated successfully");
    } else {
      console.warn("[RecordingCallback] TWILIO_AUTH_TOKEN not set - skipping signature validation");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const callSid = params.CallSid || "";
    const recordingSid = params.RecordingSid || "";
    const recordingUrl = params.RecordingUrl || "";
    const recordingStatus = params.RecordingStatus || "";
    const recordingDuration = parseInt(params.RecordingDuration || "0");

    console.log("[RecordingCallback] Recording details:", {
      callSid,
      recordingSid,
      recordingStatus,
      recordingUrl,
      recordingDuration,
    });

    if (recordingStatus !== "completed" || !recordingUrl) {
      console.log("[RecordingCallback] Recording not completed or no URL, skipping");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[RecordingCallback] Business not found:", businessError);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Get Twilio credentials for downloading the recording
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("[RecordingCallback] Missing Twilio credentials");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Download the recording from Twilio (with authentication)
    const recordingDownloadUrl = `${recordingUrl}.mp3`;
    const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    console.log("[RecordingCallback] Downloading recording from:", recordingDownloadUrl);

    const recordingResponse = await fetch(recordingDownloadUrl, {
      headers: { Authorization: authHeader },
    });

    if (!recordingResponse.ok) {
      console.error("[RecordingCallback] Failed to download recording:", recordingResponse.status);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const audioBlob = await recordingResponse.blob();
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);

    // Generate a unique filename
    const filename = `${business.id}/${callSid}-${recordingSid}.mp3`;

    console.log("[RecordingCallback] Uploading to storage:", filename);

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(filename, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[RecordingCallback] Upload error:", uploadError);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    console.log("[RecordingCallback] Recording stored at:", filename);

    // Update the call log with the recording URL and duration
    const { error: updateError } = await supabase
      .from("calls_log")
      .update({
        recording_url: filename, // Store the path, not the full URL (for signed URL generation)
        duration_ms: recordingDuration * 1000,
      })
      .eq("twilio_call_sid", callSid)
      .eq("business_id", business.id);

    if (updateError) {
      console.error("[RecordingCallback] Error updating call log:", updateError);
    } else {
      console.log("[RecordingCallback] Call log updated with recording URL");
    }

    // Request transcription from Twilio (async, will be handled separately)
    try {
      const transcriptionResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Recordings/${recordingSid}/Transcriptions.json`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "TranscriptionCallback": `${supabaseUrl}/functions/v1/twilio-transcription-callback/${token}`,
          }),
        }
      );

      if (!transcriptionResponse.ok) {
        console.log("[RecordingCallback] Transcription request failed:", await transcriptionResponse.text());
      } else {
        console.log("[RecordingCallback] Transcription requested successfully");
      }
    } catch (e) {
      console.error("[RecordingCallback] Error requesting transcription:", e);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("[RecordingCallback] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
