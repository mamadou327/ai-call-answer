import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use Twilio to generate a short voice preview via their TTS
// Since we can't get raw audio from Polly without AWS SDK, we'll use a simple approach
// that tells users to call the number to hear the voice

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceId, businessName } = await req.json();

    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "Voice ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the voice name from the Polly voice ID (e.g., "Polly.Amy-Neural" -> "Amy")
    const voiceName = voiceId.replace("Polly.", "").replace("-Neural", "");
    
    // Generate sample text
    const sampleText = businessName 
      ? `Hello, thank you for calling ${businessName}. How can I help you today?`
      : `Hello, thank you for calling. How can I help you today?`;

    // We'll use the Web Speech API on the frontend as a fallback
    // since generating actual Polly audio requires AWS credentials
    // Instead, return the sample text and voice info for frontend to handle
    return new Response(
      JSON.stringify({ 
        success: true,
        voiceName,
        sampleText,
        voiceId,
        message: "Voice preview info ready"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GeneratePollyPreview] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate preview" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
