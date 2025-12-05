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
        JSON.stringify({ assistantMessage: "Missing required fields", action: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========== AUTHORIZATION CHECK ===========
    // Extract and verify JWT to ensure caller has access to this business
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized - missing authentication", action: null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized - invalid token", action: null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the authenticated user has access to this business
    // Check 1: Is the user the business owner?
    const { data: businessOwnerCheck } = await supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();

    // Check 2: Does the user have an active staff membership for this business?
    const { data: staffMembershipCheck } = await supabase
      .from("staff_memberships")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!businessOwnerCheck && !staffMembershipCheck) {
      console.error(`User ${user.id} attempted to access business ${businessId} without authorization`);
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized - you don't have access to this business", action: null }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the verified user ID for all operations (not the client-provided userId)
    const verifiedUserId = user.id;
    console.log(`Authorized access: user ${verifiedUserId} accessing business ${businessId} (owner: ${!!businessOwnerCheck}, staff: ${!!staffMembershipCheck})`);
    // =========== END AUTHORIZATION CHECK ===========

    // Fetch business context data
    const [
      { data: business },
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: upcomingBookings },
      { data: customers },
    ] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", businessId).single(),
      supabase.from("services").select("*").eq("business_id", businessId),
      supabase.from("staff").select("*").eq("business_id", businessId),
      supabase.from("opening_hours").select("*").eq("business_id", businessId).order("day_of_week"),
      supabase
        .from("bookings")
        .select("*, service:service_id(name, duration_minutes), staff:staff_id(name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .gte("start_time", new Date().toISOString().split("T")[0])
        .order("start_time")
        .limit(50),
      supabase.from("customers").select("id, name, phone, email").eq("business_id", businessId).limit(100),
    ]);

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedHours = openingHours?.map((h: any) => ({
      dayIndex: h.day_of_week,
      day: dayNames[h.day_of_week],
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    }));

    const today = new Date();
    const systemPrompt = `You are Aivia, an AI assistant for "${business?.business_name || "this business"}". You help ${role === "owner" ? "business owners" : "staff members"} manage bookings, check schedules, and answer questions.

CURRENT DATE/TIME: ${today.toISOString()}
TODAY IS: ${dayNames[today.getDay()]} (index ${today.getDay()})

BUSINESS CONTEXT:
- Business: ${business?.business_name}
- Address: ${business?.address}
- Phone: ${business?.main_phone}

SERVICES (use these exact names when matching):
${services?.map((s: any) => `- "${s.name}" (${s.duration_minutes} minutes, price: ${s.price})`).join("\n") || "No services configured"}

STAFF MEMBERS (use these exact names when matching):
${staff?.map((s: any) => `- "${s.name}" (${s.role})`).join("\n") || "No staff configured"}

OPENING HOURS (day_of_week: 0=Sunday, 1=Monday, ... 6=Saturday):
${formattedHours?.map((h: any) => `- ${h.day} (${h.dayIndex}): ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

UPCOMING BOOKINGS:
${upcomingBookings?.map((b: any) => `- ${b.start_time}: ${b.customer_name} (phone: ${b.customer_phone || "N/A"}) with ${b.staff?.name || "unassigned"} for "${b.service?.name || "unknown"}" [status: ${b.status}, id: ${b.id}]`).join("\n") || "No upcoming bookings"}

KNOWN CUSTOMERS:
${customers?.slice(0, 20).map((c: any) => `- ${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` - ${c.email}` : ""}`).join("\n") || "No customers yet"}

YOUR CAPABILITIES:
1. CREATE BOOKING - When user wants to book an appointment
2. CANCEL BOOKING - When user wants to cancel an existing booking
3. RESCHEDULE BOOKING - When user wants to change booking time
4. ANSWER QUESTIONS - About schedules, availability, services, etc.

RESPONSE FORMAT - YOU MUST RESPOND WITH VALID JSON ONLY, NO MARKDOWN:
{
  "action": "create_booking" | "cancel_booking" | "reschedule_booking" | "answer",
  "params": {
    // For create_booking:
    "customer_name": "string (required)",
    "customer_phone": "string (optional)",
    "customer_email": "string (optional)", 
    "service_name": "string - exact match from services list",
    "staff_name": "string - exact match from staff list",
    "date": "YYYY-MM-DD format",
    "time": "HH:MM format (24h)",
    "notes": "string (optional)"
    
    // For cancel_booking:
    "booking_id": "uuid of booking to cancel"
    
    // For reschedule_booking:
    "booking_id": "uuid of booking",
    "new_date": "YYYY-MM-DD",
    "new_time": "HH:MM (24h)"
  },
  "message": "Friendly confirmation or question for the user"
}

IMPORTANT RULES:
- ALWAYS respond with valid JSON only - no markdown code blocks, no extra text
- For dates: "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}, calculate relative dates correctly
- Match service/staff names EXACTLY as listed above (case-insensitive matching is OK)
- Validate the booking time is within opening hours for that day
- If required info is missing, set action to "answer" and ask for it in message
- For cancel/reschedule, find the booking ID from the UPCOMING BOOKINGS list
- Be helpful and concise in your messages`;

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
          JSON.stringify({ assistantMessage: "Rate limit exceeded. Please try again in a moment.", action: null }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ assistantMessage: "AI credits exhausted. Please contact support.", action: null }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let assistantContent = aiData.choices?.[0]?.message?.content || "";
    
    console.log("Raw AI response:", assistantContent);

    // Clean up response - remove markdown code blocks if present
    assistantContent = assistantContent.trim();
    if (assistantContent.startsWith("```json")) {
      assistantContent = assistantContent.slice(7);
    } else if (assistantContent.startsWith("```")) {
      assistantContent = assistantContent.slice(3);
    }
    if (assistantContent.endsWith("```")) {
      assistantContent = assistantContent.slice(0, -3);
    }
    assistantContent = assistantContent.trim();

    // Try to parse as JSON
    let parsed: any = null;
    try {
      parsed = JSON.parse(assistantContent);
    } catch (e) {
      console.log("Failed to parse AI response as JSON, treating as plain text");
      // If not valid JSON, return as plain message
      return new Response(
        JSON.stringify({ assistantMessage: assistantContent || "I'm not sure how to help with that.", action: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // We have valid JSON - execute the action
    const action = parsed.action;
    const params = parsed.params || {};
    let friendlyMessage = parsed.message || "Request processed.";

    if (action === "create_booking") {
      const result = await createBooking(supabase, businessId, verifiedUserId, params, services || [], staff || [], openingHours || []);
      return new Response(
        JSON.stringify({ 
          assistantMessage: result.message, 
          action: result.success ? "create_booking" : null,
          metadata: result.metadata 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cancel_booking") {
      const result = await cancelBooking(supabase, businessId, verifiedUserId, params);
      return new Response(
        JSON.stringify({ 
          assistantMessage: result.message, 
          action: result.success ? "cancel_booking" : null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reschedule_booking") {
      const result = await rescheduleBooking(supabase, businessId, verifiedUserId, params, openingHours || []);
      return new Response(
        JSON.stringify({ 
          assistantMessage: result.message, 
          action: result.success ? "reschedule_booking" : null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: just answer
    return new Response(
      JSON.stringify({ assistantMessage: friendlyMessage, action: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ assistantMessage: "An error occurred. Please try again.", action: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Find service by name (case-insensitive, partial match)
function findService(services: any[], name: string): any | null {
  if (!name || !services?.length) return null;
  const lower = name.toLowerCase();
  return services.find(s => s.name.toLowerCase() === lower) 
    || services.find(s => s.name.toLowerCase().includes(lower))
    || services.find(s => lower.includes(s.name.toLowerCase()));
}

// Helper: Find staff by name (case-insensitive, partial match)
function findStaff(staffList: any[], name: string): any | null {
  if (!name || !staffList?.length) return null;
  const lower = name.toLowerCase();
  return staffList.find(s => s.name.toLowerCase() === lower)
    || staffList.find(s => s.name.toLowerCase().includes(lower))
    || staffList.find(s => lower.includes(s.name.toLowerCase()));
}

// Helper: Check if time is within opening hours
function isWithinOpeningHours(openingHours: any[], date: Date, endDate: Date): { valid: boolean; reason?: string } {
  const dayOfWeek = date.getDay();
  const hours = openingHours?.find((h: any) => h.day_of_week === dayOfWeek);
  
  if (!hours) {
    return { valid: false, reason: "Opening hours not configured for this day" };
  }
  
  if (hours.is_closed) {
    return { valid: false, reason: "The business is closed on this day" };
  }
  
  const timeStr = date.toTimeString().slice(0, 5); // HH:MM
  const endTimeStr = endDate.toTimeString().slice(0, 5);
  
  if (timeStr < hours.open_time) {
    return { valid: false, reason: `The business opens at ${hours.open_time}` };
  }
  
  if (endTimeStr > hours.close_time) {
    return { valid: false, reason: `The booking would end after closing time (${hours.close_time})` };
  }
  
  return { valid: true };
}

// Create booking action
async function createBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  services: any[],
  staffList: any[],
  openingHours: any[]
): Promise<{ success: boolean; message: string; metadata?: any }> {
  const { customer_name, customer_phone, customer_email, service_name, staff_name, date, time, notes } = params;

  // Validate required fields
  if (!customer_name) {
    return { success: false, message: "I need the customer's name to create a booking. Who is the appointment for?" };
  }
  if (!date || !time) {
    return { success: false, message: "I need a date and time for the booking. When would you like to schedule it?" };
  }

  // Find service
  const service = findService(services, service_name);
  if (service_name && !service) {
    const availableServices = services?.map(s => s.name).join(", ") || "none";
    return { success: false, message: `I couldn't find the service "${service_name}". Available services: ${availableServices}` };
  }

  // Find staff
  const staffMember = findStaff(staffList, staff_name);
  if (staff_name && !staffMember) {
    const availableStaff = staffList?.map(s => s.name).join(", ") || "none";
    return { success: false, message: `I couldn't find staff member "${staff_name}". Available staff: ${availableStaff}` };
  }

  // Parse date and time
  const startDate = new Date(`${date}T${time}:00`);
  if (isNaN(startDate.getTime())) {
    return { success: false, message: "I couldn't understand the date/time. Please use format like '2024-01-15' and '14:30'." };
  }

  // Check if date is in the past
  if (startDate < new Date()) {
    return { success: false, message: "I can't book appointments in the past. Please choose a future date and time." };
  }

  // Calculate end time based on service duration
  const duration = service?.duration_minutes || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  // Check opening hours
  const hoursCheck = isWithinOpeningHours(openingHours, startDate, endDate);
  if (!hoursCheck.valid) {
    return { success: false, message: `${hoursCheck.reason}. Please choose a different time.` };
  }

  // Check for conflicts with existing bookings
  if (staffMember) {
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id, start_time, customer_name")
      .eq("business_id", businessId)
      .eq("staff_id", staffMember.id)
      .neq("status", "cancelled")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflicts && conflicts.length > 0) {
      // Find alternative times
      const suggestedTime = new Date(startDate.getTime() + duration * 60000 + 30 * 60000);
      const suggestedStr = suggestedTime.toTimeString().slice(0, 5);
      return { 
        success: false, 
        message: `${staffMember.name} already has a booking at that time (${conflicts[0].customer_name}). Would you like to book at ${suggestedStr} instead?` 
      };
    }
  }

  // Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: customer_phone || "",
      service_id: service?.id || null,
      staff_id: staffMember?.id || null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      notes: notes || null,
      created_by: "ai_assistant",
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (bookingError) {
    console.error("Booking creation error:", bookingError);
    return { success: false, message: "Sorry, I couldn't create the booking. Please try again or use the booking form." };
  }

  // Upsert customer if phone/email provided
  if (customer_phone || customer_email) {
    await supabase
      .from("customers")
      .upsert({
        business_id: businessId,
        name: customer_name,
        phone: customer_phone || null,
        email: customer_email || null,
      }, { 
        onConflict: "business_id,phone",
        ignoreDuplicates: true 
      });
  }

  const formattedDate = startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const formattedTime = startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  
  return { 
    success: true, 
    message: `✅ Booked! ${customer_name} with ${staffMember?.name || "any available staff"} for ${service?.name || "appointment"} on ${formattedDate} at ${formattedTime}.`,
    metadata: { bookingId: booking.id }
  };
}

// Cancel booking action  
async function cancelBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any
): Promise<{ success: boolean; message: string }> {
  const { booking_id } = params;

  if (!booking_id) {
    return { success: false, message: "Which booking would you like to cancel? Please specify the customer name or booking details." };
  }

  // Verify booking exists and belongs to this business
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*, customer_name, start_time")
    .eq("id", booking_id)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !booking) {
    return { success: false, message: "I couldn't find that booking. Please check the booking details." };
  }

  if (booking.status === "cancelled") {
    return { success: false, message: "This booking is already cancelled." };
  }

  // Cancel the booking
  const { error } = await supabase
    .from("bookings")
    .update({ 
      status: "cancelled", 
      cancelled_at: new Date().toISOString(), 
      cancelled_by_user_id: userId 
    })
    .eq("id", booking_id);

  if (error) {
    console.error("Cancel booking error:", error);
    return { success: false, message: "Sorry, I couldn't cancel the booking. Please try again." };
  }

  const formattedDate = new Date(booking.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return { success: true, message: `✅ Cancelled ${booking.customer_name}'s booking on ${formattedDate}.` };
}

// Reschedule booking action
async function rescheduleBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  openingHours: any[]
): Promise<{ success: boolean; message: string }> {
  const { booking_id, new_date, new_time } = params;

  if (!booking_id) {
    return { success: false, message: "Which booking would you like to reschedule?" };
  }
  if (!new_date || !new_time) {
    return { success: false, message: "What date and time would you like to reschedule to?" };
  }

  // Get the booking with service info
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*, service:service_id(duration_minutes, name), staff:staff_id(name)")
    .eq("id", booking_id)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !booking) {
    return { success: false, message: "I couldn't find that booking." };
  }

  if (booking.status === "cancelled") {
    return { success: false, message: "This booking is cancelled and can't be rescheduled." };
  }

  const duration = booking.service?.duration_minutes || 60;
  const startDate = new Date(`${new_date}T${new_time}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    return { success: false, message: "I couldn't understand the new date/time." };
  }

  if (startDate < new Date()) {
    return { success: false, message: "I can't reschedule to a past time." };
  }

  // Check opening hours
  const hoursCheck = isWithinOpeningHours(openingHours, startDate, endDate);
  if (!hoursCheck.valid) {
    return { success: false, message: `${hoursCheck.reason}. Please choose a different time.` };
  }

  // Check for conflicts
  if (booking.staff_id) {
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", businessId)
      .eq("staff_id", booking.staff_id)
      .neq("id", booking_id)
      .neq("status", "cancelled")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflicts && conflicts.length > 0) {
      return { success: false, message: "That time slot is already taken. Please choose a different time." };
    }
  }

  // Update the booking
  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      last_modified_by_user_id: userId,
    })
    .eq("id", booking_id);

  if (error) {
    console.error("Reschedule error:", error);
    return { success: false, message: "Sorry, I couldn't reschedule the booking." };
  }

  const formattedDate = startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const formattedTime = startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  
  return { 
    success: true, 
    message: `✅ Rescheduled ${booking.customer_name}'s appointment to ${formattedDate} at ${formattedTime}.` 
  };
}
