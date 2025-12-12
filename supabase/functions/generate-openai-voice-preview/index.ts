import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenAI TTS supported voices (subset of realtime voices)
const TTS_SUPPORTED_VOICES = ["alloy", "ash", "coral", "echo", "sage", "shimmer"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceId } = await req.json();

    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "voiceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if voice supports TTS preview
    if (!TTS_SUPPORTED_VOICES.includes(voiceId)) {
      return new Response(
        JSON.stringify({ error: "Preview not available for this voice", unsupported: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const previewText = "Hi, thanks for calling. How can I help you today?";

    console.log(`[VoicePreview] Generating preview for voice: ${voiceId}`);

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: previewText,
        voice: voiceId,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoicePreview] OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate audio preview" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 using chunked approach to avoid stack overflow
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64Audio = btoa(binary);

    console.log(`[VoicePreview] Successfully generated preview for ${voiceId}`);

    return new Response(
      JSON.stringify({ 
        audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
        voice: voiceId,
        text: previewText
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[VoicePreview] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
