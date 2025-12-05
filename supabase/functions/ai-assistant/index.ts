import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  businessId: string;
  userId: string;
  role: "owner" | "staff";
  messages: Message[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { businessId, userId, role, messages }: RequestBody = await req.json();

    if (!businessId || !userId || !messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch business context data
    const [
      { data: business },
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: todayBookings },
      { data: customers },
    ] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", businessId).single(),
      supabase.from("services").select("*").eq("business_id", businessId),
      supabase.from("staff").select("*").eq("business_id", businessId),
      supabase.from("opening_hours").select("*").eq("business_id", businessId).order("day_of_week"),
      supabase
        .from("bookings")
        .select("*, service:service_id(name), staff:staff_id(name)")
        .eq("business_id", businessId)
        .gte("start_time", new Date().toISOString().split("T")[0])
        .order("start_time"),
      supabase.from("customers").select("id, name, phone, email").eq("business_id", businessId).limit(100),
    ]);

    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const formattedHours = openingHours?.map((h: any) => ({
      day: dayNames[h.day_of_week],
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    }));

    const today = new Date();
    const systemPrompt = `You are Aivia, an AI assistant for "${business?.business_name || "this business"}". You help ${role === "owner" ? "business owners" : "staff members"} manage bookings, check schedules, and answer questions.

CURRENT DATE/TIME: ${today.toLocaleString()}
TODAY IS: ${dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1]}

BUSINESS CONTEXT:
- Business: ${business?.business_name}
- Address: ${business?.address}
- Phone: ${business?.main_phone}

SERVICES (id, name, duration_minutes, price):
${services?.map((s: any) => `- ${s.id}: ${s.name} (${s.duration_minutes}min, ${s.price})`).join("\n") || "No services configured"}

STAFF MEMBERS (id, name, role):
${staff?.map((s: any) => `- ${s.id}: ${s.name} (${s.role})`).join("\n") || "No staff configured"}

OPENING HOURS:
${formattedHours?.map((h: any) => `- ${h.day}: ${h.isClosed ? "Closed" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

UPCOMING BOOKINGS (next 7 days):
${todayBookings?.slice(0, 20).map((b: any) => `- ${new Date(b.start_time).toLocaleString()}: ${b.customer_name} with ${b.staff?.name || "unassigned"} for ${b.service?.name || "unknown"} (${b.status})`).join("\n") || "No upcoming bookings"}

KNOWN CUSTOMERS (sample):
${customers?.slice(0, 20).map((c: any) => `- ${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` - ${c.email}` : ""}`).join("\n") || "No customers yet"}

CAPABILITIES:
1. CREATE BOOKING: Extract customer name, phone (optional), service, staff, date, time. Return action "create_booking" with extracted data.
2. CANCEL BOOKING: Identify which booking to cancel. Return action "cancel_booking".
3. RESCHEDULE BOOKING: Identify booking and new date/time. Return action "reschedule_booking".
4. ANSWER QUESTIONS: About schedules, availability, bookings, etc.

RESPONSE FORMAT:
For actions, respond with JSON in this exact format (no markdown):
{"action": "create_booking", "data": {"customer_name": "...", "customer_phone": "...", "service_id": "...", "staff_id": "...", "start_time": "ISO datetime", "notes": "..."}, "message": "Human readable confirmation"}

For questions or when no action is needed, respond with plain text.

RULES:
- Always validate against opening hours
- Match staff/service names flexibly (partial matches OK)
- If info is missing, ask for it
- Be concise and helpful
- For dates like "tomorrow", "next Monday", calculate actual dates
- Default to reasonable assumptions when possible (e.g., first available staff if not specified)`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantContent = aiData.choices?.[0]?.message?.content || "I couldn't process that request.";

    // Try to parse as JSON action
    let response = assistantContent;
    try {
      const parsed = JSON.parse(assistantContent);
      if (parsed.action && parsed.data) {
        // Execute the action
        const actionResult = await executeAction(supabase, businessId, userId, parsed);
        response = actionResult.message;
      }
    } catch {
      // Not JSON, just a text response - that's fine
    }

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeAction(
  supabase: any,
  businessId: string,
  userId: string,
  parsed: { action: string; data: any; message: string }
): Promise<{ success: boolean; message: string }> {
  const { action, data, message } = parsed;

  try {
    switch (action) {
      case "create_booking": {
        const { customer_name, customer_phone, service_id, staff_id, start_time, notes } = data;

        if (!customer_name || !start_time) {
          return { success: false, message: "I need at least a customer name and time to create a booking." };
        }

        // Get service duration
        let duration = 60; // default
        if (service_id) {
          const { data: service } = await supabase
            .from("services")
            .select("duration_minutes")
            .eq("id", service_id)
            .single();
          if (service) duration = service.duration_minutes;
        }

        const startDate = new Date(start_time);
        const endDate = new Date(startDate.getTime() + duration * 60000);

        // Check for conflicts if staff assigned
        if (staff_id) {
          const { data: conflicts } = await supabase
            .from("bookings")
            .select("id")
            .eq("business_id", businessId)
            .eq("staff_id", staff_id)
            .neq("status", "cancelled")
            .lt("start_time", endDate.toISOString())
            .gt("end_time", startDate.toISOString());

          if (conflicts && conflicts.length > 0) {
            return { success: false, message: `That time slot conflicts with an existing booking. Please choose a different time.` };
          }
        }

        // Create booking
        const { error: bookingError } = await supabase.from("bookings").insert({
          business_id: businessId,
          customer_name,
          customer_phone: customer_phone || "",
          service_id: service_id || null,
          staff_id: staff_id || null,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          status: "confirmed",
          notes: notes || null,
          created_by: "ai_assistant",
          created_by_user_id: userId,
        });

        if (bookingError) {
          console.error("Booking creation error:", bookingError);
          return { success: false, message: "Failed to create the booking. Please try again." };
        }

        return { success: true, message };
      }

      case "cancel_booking": {
        const { booking_id } = data;
        if (!booking_id) {
          return { success: false, message: "I need to know which booking to cancel. Can you be more specific?" };
        }

        const { error } = await supabase
          .from("bookings")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by_user_id: userId })
          .eq("id", booking_id)
          .eq("business_id", businessId);

        if (error) {
          return { success: false, message: "Failed to cancel the booking." };
        }

        return { success: true, message };
      }

      case "reschedule_booking": {
        const { booking_id, new_start_time } = data;
        if (!booking_id || !new_start_time) {
          return { success: false, message: "I need the booking ID and new time to reschedule." };
        }

        // Get original booking
        const { data: booking } = await supabase
          .from("bookings")
          .select("*, service:service_id(duration_minutes)")
          .eq("id", booking_id)
          .single();

        if (!booking) {
          return { success: false, message: "Booking not found." };
        }

        const duration = booking.service?.duration_minutes || 60;
        const startDate = new Date(new_start_time);
        const endDate = new Date(startDate.getTime() + duration * 60000);

        const { error } = await supabase
          .from("bookings")
          .update({
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            last_modified_by_user_id: userId,
          })
          .eq("id", booking_id);

        if (error) {
          return { success: false, message: "Failed to reschedule the booking." };
        }

        return { success: true, message };
      }

      default:
        return { success: false, message };
    }
  } catch (error) {
    console.error("Action execution error:", error);
    return { success: false, message: "An error occurred while processing the action." };
  }
}
