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
    const { documentText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Analyze with AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert business policy analyzer. Your task is to thoroughly extract and structure all relevant policy information from documents. Pay special attention to cancellation policies, refund rules, booking requirements, notice periods, and any other customer-facing policies."
          },
          {
            role: "user",
            content: `Analyze this policy document in detail and extract ALL relevant information:\n\n${documentText}\n\nExtract the following information and return as JSON:\n{\n  "cancellation_policy": "Complete cancellation policy text with all details about when customers can cancel, how to cancel, what happens if they cancel at different times, any fees or penalties, and refund terms",\n  "min_booking_notice_hours": number (minimum hours in advance customers must book),\n  "min_cancellation_notice_hours": number (minimum hours before appointment customers can cancel without penalty),\n  "max_days_advance": number (maximum days in advance customers can book),\n  "refund_policy": "Full refund policy including timelines and conditions",\n  "no_show_policy": "Policy for customers who don't show up for appointments",\n  "rescheduling_policy": "Rules for rescheduling appointments",\n  "deposit_policy": "Information about deposits or advance payments if applicable",\n  "late_arrival_policy": "Policy for customers arriving late",\n  "payment_terms": "When and how payment is expected",\n  "special_terms": "Any other important terms and conditions"\n}\n\nBe thorough and extract every policy detail mentioned in the document. If a field is not mentioned in the document, omit it from the JSON.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API Error:", aiResponse.status, errorText);
      
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
      throw new Error(`AI analysis failed: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const policyText = aiData.choices[0].message.content;
    
    // Try to parse JSON
    let policies;
    try {
      const jsonMatch = policyText.match(/```json\n([\s\S]*?)\n```/) || 
                       policyText.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : policyText;
      policies = JSON.parse(jsonStr);
    } catch (e) {
      policies = { cancellation_policy: policyText };
    }

    return new Response(
      JSON.stringify({ success: true, policies }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-policy-document:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze document";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
