import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo scripts for each scenario
const DEMO_SCRIPTS = {
  booking: [
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA, your AI assistant. How can I help you today?" },
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
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA. How can I help you today?" },
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
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA. How can I help you today?" },
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

// Voice mapping - AIVIA uses warm voice, customer uses different voice
const VOICE_MAP = {
  aivia: "coral", // Warm and friendly
  customer: "ash", // Natural, conversational
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenario, aiviaVoice } = await req.json();

    if (!scenario || !DEMO_SCRIPTS[scenario as keyof typeof DEMO_SCRIPTS]) {
      return new Response(
        JSON.stringify({ error: "Invalid scenario. Use: booking, reschedule, or cancel" }),
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

    const script = DEMO_SCRIPTS[scenario as keyof typeof DEMO_SCRIPTS];
    const audioSegments: ArrayBuffer[] = [];

    console.log(`Generating ${scenario} demo with ${script.length} lines...`);

    // Generate audio for each line
    for (const line of script) {
      const voice = line.speaker === "aivia" ? (aiviaVoice || VOICE_MAP.aivia) : VOICE_MAP.customer;
      
      console.log(`Generating: [${line.speaker}] "${line.text.substring(0, 30)}..." with voice: ${voice}`);

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: line.text,
          voice: voice,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`OpenAI TTS error: ${error}`);
        throw new Error(`Failed to generate audio: ${error}`);
      }

      const audioBuffer = await response.arrayBuffer();
      audioSegments.push(audioBuffer);
    }

    // Combine all audio segments (simple concatenation for MP3)
    // Note: For production, you might want to add silence between segments
    const totalLength = audioSegments.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const segment of audioSegments) {
      combined.set(new Uint8Array(segment), offset);
      offset += segment.byteLength;
    }

    // Convert to base64
    const base64Audio = btoa(String.fromCharCode(...combined));

    console.log(`Generated demo call audio: ${(totalLength / 1024).toFixed(1)}KB`);

    return new Response(
      JSON.stringify({
        audioUrl: `data:audio/mp3;base64,${base64Audio}`,
        scenario,
        linesCount: script.length,
        transcript: script,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Demo call generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate demo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
