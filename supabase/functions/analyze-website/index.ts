import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch website content
    const websiteResponse = await fetch(websiteUrl);
    const websiteContent = await websiteResponse.text();
    
    // Truncate content if too long (keep first 50000 chars)
    const truncatedContent = websiteContent.substring(0, 50000);

    // Analyze with AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a business information extraction assistant. Analyze the website content and extract structured business information including staff members, services offered, opening hours, and policies. Return the information in JSON format."
          },
          {
            role: "user",
            content: `Analyze this website content and extract:\n1. Staff members (name, role)\n2. Services (name, description, approximate duration in minutes, approximate price)\n3. Opening hours (days and times)\n4. Business policies (cancellation, refund, booking rules)\n\nWebsite URL: ${websiteUrl}\n\nWebsite Content:\n${truncatedContent}\n\nReturn as JSON with this structure:\n{\n  "staff": [{"name": "...", "role": "..."}],\n  "services": [{"name": "...", "description": "...", "duration_minutes": 60, "price": 50, "category": "..."}],\n  "opening_hours": [{"day": 0-6, "open_time": "09:00", "close_time": "17:00", "is_closed": false}],\n  "policies": {"cancellation_policy": "...", "min_booking_notice_hours": 24, "min_cancellation_notice_hours": 24, "max_days_advance": 30}\n}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0].message.content;
    
    // Try to parse JSON from the response
    let analysis;
    try {
      // Extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                       analysisText.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : analysisText;
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      // If parsing fails, return the raw text
      analysis = { raw_analysis: analysisText };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-website:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze website";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
