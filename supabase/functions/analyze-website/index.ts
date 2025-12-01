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
    
    // Truncate content if too long (keep first 100000 chars for more thorough analysis)
    const truncatedContent = websiteContent.substring(0, 100000);

    // Analyze with AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: "You are an expert business intelligence analyst specializing in extracting comprehensive information from business websites. Your goal is to thoroughly analyze website content and extract ALL available business information in a structured format. Be meticulous and extract every relevant detail you can find."
          },
          {
            role: "user",
            content: `Perform a comprehensive analysis of this business website and extract ALL available information:\n\nWebsite URL: ${websiteUrl}\n\nWebsite Content:\n${truncatedContent}\n\nExtract the following information in detail:\n\n1. **Staff/Team Members**: Extract ALL staff members mentioned with:\n   - Full name\n   - Job title/role\n   - Specialties or areas of expertise\n   - Qualifications or certifications\n   - Years of experience\n   - Bio or description\n   - Contact information (email, phone) if available\n\n2. **Services**: Extract ALL services offered with:\n   - Service name\n   - Detailed description\n   - Duration in minutes (if mentioned, otherwise estimate based on service type)\n   - Price (if mentioned, otherwise note as "Contact for pricing")\n   - Category (e.g., "Haircut", "Color", "Treatment", etc.)\n   - Any special notes or requirements\n\n3. **Opening Hours**: Extract business hours for each day:\n   - day: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday\n   - open_time: "HH:MM" format (24-hour)\n   - close_time: "HH:MM" format (24-hour)\n   - is_closed: true if closed that day\n   - Special hours or holiday hours if mentioned\n\n4. **Business Policies**: Extract ALL policy information:\n   - Cancellation policy with full details\n   - Minimum booking notice (convert to hours)\n   - Minimum cancellation notice (convert to hours)\n   - Maximum days in advance for booking\n   - Refund policy\n   - Late arrival policy\n   - No-show policy\n   - Payment policies\n   - Any other terms and conditions\n\n5. **Additional Business Information**:\n   - Business address (full address)\n   - Contact phone numbers\n   - Email addresses\n   - Social media links\n   - Business description/about\n   - Specializations or unique selling points\n   - Awards or certifications\n   - Years in business\n\nReturn as JSON with this exact structure:\n{\n  "staff": [{"name": "Full Name", "role": "Job Title", "email": "email if available", "phone": "phone if available", "bio": "description", "specialties": ["specialty1", "specialty2"]}],\n  "services": [{"name": "Service Name", "description": "Detailed description", "duration_minutes": 60, "price": 50, "category": "Category Name"}],\n  "opening_hours": [{"day": 0, "open_time": "09:00", "close_time": "17:00", "is_closed": false}],\n  "policies": {"cancellation_policy": "Full policy text", "min_booking_notice_hours": 24, "min_cancellation_notice_hours": 24, "max_days_advance": 30, "refund_policy": "...", "late_policy": "...", "no_show_policy": "..."},\n  "business_info": {"address": "Full address", "phone": ["phone numbers"], "email": ["email addresses"], "description": "About the business", "specializations": ["specialization1"]}\n}\n\nBe thorough and extract EVERY piece of relevant information you can find. If information is not available, omit that field rather than guessing.`
          }
        ],
        temperature: 0.3,
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
