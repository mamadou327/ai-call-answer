import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_NAME = "Coral";

// Demo scripts for each scenario
const DEMO_SCRIPTS = {
  booking: [
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}, your AI assistant. How can I help you today?` },
    { speaker: "customer", text: "Hi, I'd like to book a haircut please." },
    { speaker: "aivia", text: "Of course! I'd be happy to help you book a haircut. When would you like to come in?" },
    { speaker: "customer", text: "Tomorrow afternoon if possible?" },
    { speaker: "aivia", text: "Let me check... I have availability tomorrow at 2pm or 3:30pm. Which works better for you?" },
    { speaker: "customer", text: "2pm would be perfect." },
    { speaker: "aivia", text: "Excellent! Can I take your name please?" },
    { speaker: "customer", text: "It's Sarah." },
    { speaker: "aivia", text: "Perfect, Sarah! Your haircut is confirmed for tomorrow at 2pm. We'll send you a confirmation text shortly. Is there anything else I can help you with?" },
    { speaker: "customer", text: "No, that's everything. Thank you!" },
    { speaker: "aivia", text: "You're welcome! We look forward to seeing you tomorrow. Have a lovely day!" },
  ],
  reschedule: [
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}. How can I help you today?` },
    { speaker: "customer", text: "Hi, I have an appointment booked but I need to change it." },
    { speaker: "aivia", text: "No problem at all! Can I take your name or booking reference?" },
    { speaker: "customer", text: "It's Sarah. I'm booked for tomorrow at 2pm." },
    { speaker: "aivia", text: "I found your haircut booking for tomorrow at 2pm. When would you like to reschedule to?" },
    { speaker: "customer", text: "Can I move it to Friday at 11am?" },
    { speaker: "aivia", text: "Let me check... Yes, Friday at 11am is available! I've moved your appointment. You'll receive a new confirmation text." },
    { speaker: "customer", text: "That's great, thank you so much!" },
    { speaker: "aivia", text: "You're welcome, Sarah! We'll see you Friday at 11am. Have a lovely day!" },
  ],
  cancel: [
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}. How can I help you today?` },
    { speaker: "customer", text: "Hi, I need to cancel my appointment please." },
    { speaker: "aivia", text: "I'm sorry to hear that. Can I take your name or booking reference?" },
    { speaker: "customer", text: "It's Sarah. I'm booked for Friday at 11am." },
    { speaker: "aivia", text: "I found your haircut booking for Friday at 11am. Are you sure you'd like to cancel?" },
    { speaker: "customer", text: "Yes please." },
    { speaker: "aivia", text: "No problem, I've cancelled that for you. Would you like to rebook for another time?" },
    { speaker: "customer", text: "Not right now, but I'll call back." },
    { speaker: "aivia", text: "Of course! We'd love to see you soon. Have a lovely day, Sarah!" },
  ],
};

// ElevenLabs voice IDs
const ELEVENLABS_VOICES = {
  aivia: "EXAVITQu4vr4xnSDxMaL", // Sarah - warm, professional
  customer: "cgSgspJ2msm6clMCkdW9", // Jessica - natural, friendly
};

// Generate silence MP3 (simple approach - very short silent MP3 frame)
function createSilence(durationMs: number): Uint8Array {
  // For simplicity, we'll create multiple copies of a minimal silent MP3 frame
  // Each frame is ~26ms at 128kbps
  const framesNeeded = Math.ceil(durationMs / 26);
  
  // Minimal MP3 frame (silent, 128kbps, 44100Hz, stereo)
  const silentFrame = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ]);
  
  const result = new Uint8Array(silentFrame.length * framesNeeded);
  for (let i = 0; i < framesNeeded; i++) {
    result.set(silentFrame, i * silentFrame.length);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenario } = await req.json();

    if (!scenario || !DEMO_SCRIPTS[scenario as keyof typeof DEMO_SCRIPTS]) {
      return new Response(
        JSON.stringify({ error: "Invalid scenario. Use: booking, reschedule, or cancel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const script = DEMO_SCRIPTS[scenario as keyof typeof DEMO_SCRIPTS];
    const audioSegments: Uint8Array[] = [];
    const timingData: { speaker: string; text: string; startMs: number; endMs: number }[] = [];
    let currentTimeMs = 0;

    console.log(`Generating ${scenario} demo with ${script.length} lines using ElevenLabs...`);

    // Generate audio for each line using ElevenLabs
    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      const voiceId = line.speaker === "aivia" 
        ? ELEVENLABS_VOICES.aivia 
        : ELEVENLABS_VOICES.customer;
      
      console.log(`[${i + 1}/${script.length}] Generating: [${line.speaker}] "${line.text.substring(0, 40)}..." with voice: ${voiceId}`);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: line.text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs error: ${errorText}`);
        throw new Error(`Failed to generate audio for line ${i + 1}: ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioData = new Uint8Array(audioBuffer);
      
      // Estimate audio duration based on text length (rough estimate: 100ms per character for speech)
      const estimatedDurationMs = Math.max(1000, line.text.length * 65);
      
      // Record timing
      const startMs = currentTimeMs;
      timingData.push({
        speaker: line.speaker,
        text: line.text,
        startMs: startMs,
        endMs: startMs + estimatedDurationMs,
      });
      
      audioSegments.push(audioData);
      currentTimeMs += estimatedDurationMs;

      // Add pause between lines (400ms)
      if (i < script.length - 1) {
        const silence = createSilence(400);
        audioSegments.push(silence);
        currentTimeMs += 400;
      }
    }

    // Combine all audio segments
    const totalLength = audioSegments.reduce((acc, buf) => acc + buf.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const segment of audioSegments) {
      combined.set(segment, offset);
      offset += segment.length;
    }

    console.log(`Combined audio size: ${(totalLength / 1024).toFixed(1)}KB`);

    // Upload audio to storage
    const audioFileName = `demo-${scenario}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("demo-audio")
      .upload(audioFileName, combined, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Upload timing metadata
    const timingFileName = `demo-${scenario}-timing.json`;
    const timingJson = JSON.stringify({
      scenario,
      totalDurationMs: currentTimeMs,
      lines: timingData,
    }, null, 2);
    
    const { error: timingUploadError } = await supabase.storage
      .from("demo-audio")
      .upload(timingFileName, new TextEncoder().encode(timingJson), {
        contentType: "application/json",
        upsert: true,
      });

    if (timingUploadError) {
      console.error("Timing upload error:", timingUploadError);
      // Non-fatal, continue
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("demo-audio")
      .getPublicUrl(audioFileName);

    console.log(`Successfully generated and uploaded ${scenario} demo: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        scenario,
        audioUrl: urlData.publicUrl,
        linesCount: script.length,
        totalDurationMs: currentTimeMs,
        sizeKb: (totalLength / 1024).toFixed(1),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Demo audio generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate demo audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
