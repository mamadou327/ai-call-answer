import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// ElevenLabs voice IDs - Using high-quality voices
const ELEVENLABS_VOICES = {
  aivia: "EXAVITQu4vr4xnSDxMaL", // Sarah - warm, professional
  customer: "cgSgspJ2msm6clMCkdW9", // Jessica - natural, friendly
};

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
    
    console.log(`Generating ${scenario} demo with ${script.length} lines...`);

    // Generate and upload each line as a separate audio file
    const audioFiles: { index: number; speaker: string; text: string; fileName: string; url: string }[] = [];

    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      const voiceId = line.speaker === "aivia" 
        ? ELEVENLABS_VOICES.aivia 
        : ELEVENLABS_VOICES.customer;
      
      console.log(`[${i + 1}/${script.length}] Generating: [${line.speaker}] "${line.text.substring(0, 40)}..."`);

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
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.2,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs error for line ${i}: ${errorText}`);
        throw new Error(`Failed to generate audio for line ${i + 1}: ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioData = new Uint8Array(audioBuffer);
      
      // Upload each line as a separate file
      const fileName = `demo-${scenario}-line-${String(i).padStart(2, '0')}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from("demo-audio")
        .upload(fileName, audioData, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for line ${i}:`, uploadError);
        throw new Error(`Failed to upload line ${i}: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("demo-audio")
        .getPublicUrl(fileName);

      audioFiles.push({
        index: i,
        speaker: line.speaker,
        text: line.text,
        fileName,
        url: urlData.publicUrl,
      });

      console.log(`Uploaded line ${i + 1}: ${fileName}`);
    }

    // Create manifest with all audio files
    const manifest = {
      scenario,
      version: 2,
      generatedAt: new Date().toISOString(),
      linesCount: script.length,
      pauseBetweenLinesMs: 500,
      lines: audioFiles.map((f, idx) => ({
        index: idx,
        speaker: f.speaker,
        text: f.text,
        audioUrl: f.url,
      })),
    };

    // Upload manifest
    const manifestFileName = `demo-${scenario}-manifest.json`;
    const { error: manifestUploadError } = await supabase.storage
      .from("demo-audio")
      .upload(manifestFileName, new TextEncoder().encode(JSON.stringify(manifest, null, 2)), {
        contentType: "application/json",
        upsert: true,
      });

    if (manifestUploadError) {
      console.error("Manifest upload error:", manifestUploadError);
    }

    const { data: manifestUrlData } = supabase.storage
      .from("demo-audio")
      .getPublicUrl(manifestFileName);

    console.log(`Successfully generated ${scenario} demo with ${audioFiles.length} audio files`);

    return new Response(
      JSON.stringify({
        success: true,
        scenario,
        manifestUrl: manifestUrlData.publicUrl,
        linesCount: audioFiles.length,
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
