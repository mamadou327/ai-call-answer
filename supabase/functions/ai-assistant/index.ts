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

    const { data: businessOwnerCheck } = await supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();

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

    const verifiedUserId = user.id;
    console.log(`Authorized access: user ${verifiedUserId} accessing business ${businessId}`);
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

    // DB uses: Monday=0, Tuesday=1, ..., Sunday=6
    // JS uses: Sunday=0, Monday=1, ..., Saturday=6
    const dbDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    const today = new Date();
    const jsDayToday = today.getDay();
    const dbDayToday = jsDayToday === 0 ? 6 : jsDayToday - 1;
    
    const formattedHours = openingHours?.map((h: any) => ({
      dbDayIndex: h.day_of_week,
      day: dbDayNames[h.day_of_week],
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    }));

    // Format bookings with booking codes for easy reference
    const formattedBookings = upcomingBookings?.map((b: any) => ({
      code: b.booking_code,
      id: b.id,
      customer: b.customer_name,
      phone: b.customer_phone,
      date: new Date(b.start_time).toISOString().split("T")[0],
      time: new Date(b.start_time).toTimeString().slice(0, 5),
      staff: b.staff?.name || "unassigned",
      service: b.service?.name || "unknown",
      status: b.status,
    }));

    const systemPrompt = `You are Aivia, an AI booking assistant for "${business?.business_name || "this business"}". You help ${role === "owner" ? "business owners" : "staff members"} manage bookings.

CURRENT DATE/TIME: ${today.toISOString()}
TODAY IS: ${dbDayNames[dbDayToday]} (day ${dbDayToday})

BUSINESS INFO:
- Name: ${business?.business_name}
- Address: ${business?.address}
- Phone: ${business?.main_phone}

SERVICES:
${services?.map((s: any) => `• ${s.name} (${s.duration_minutes} min, £${s.price}) - ID: ${s.id}`).join("\n") || "No services"}

STAFF:
${staff?.map((s: any) => `• ${s.name} (${s.role}) - ID: ${s.id}`).join("\n") || "No staff"}

OPENING HOURS:
${formattedHours?.map((h: any) => `• ${h.day}: ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

UPCOMING BOOKINGS (use booking CODE to identify):
${formattedBookings?.map((b: any) => `• ${b.code}: ${b.customer} (${b.phone || "no phone"}) on ${b.date} at ${b.time} with ${b.staff} for ${b.service} [${b.status}]`).join("\n") || "No upcoming bookings"}

CUSTOMERS:
${customers?.slice(0, 15).map((c: any) => `• ${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` - ${c.email}` : ""}`).join("\n") || "No customers yet"}

YOUR CAPABILITIES:
1. CREATE BOOKING - Book appointments
2. CANCEL BOOKING - Cancel by booking code OR customer name+phone+date
3. RESCHEDULE BOOKING - Move booking to new time
4. GET SCHEDULE - Show bookings for a date range
5. ANSWER QUESTIONS - About services, hours, availability

IMPORTANT RULES:
1. Execute actions IMMEDIATELY when you have enough info
2. ALWAYS reference bookings by their CODE (like "PRE-A1B2") not by ID
3. When user says "cancel my booking" or similar, ask for booking code OR customer details to find it
4. Before cancelling/rescheduling, briefly confirm: "I found the booking for [customer] on [date]. Cancelling now."
5. NEVER show raw JSON to users - always respond naturally
6. If action succeeds, say so clearly. If it fails, explain why.

FINDING BOOKINGS:
- By booking code: Direct match (e.g., "PRE-A1B2")
- By customer: Name + phone + date/time to identify the right booking
- Always confirm which booking before making changes

RESPONSE FORMAT (JSON only, no markdown):
{
  "action": "create_booking" | "cancel_booking" | "reschedule_booking" | "get_schedule" | "answer",
  "params": {
    // For create_booking:
    "customer_name": "required",
    "customer_phone": "optional",
    "service_name": "match from services list",
    "staff_name": "match from staff list", 
    "date": "YYYY-MM-DD",
    "time": "HH:MM (24h)",
    "notes": "optional"
    
    // For cancel_booking:
    "booking_code": "PRE-XXXX" OR
    "customer_name": "name",
    "customer_phone": "phone",
    "date": "YYYY-MM-DD"
    
    // For reschedule_booking:
    "booking_code": "PRE-XXXX" OR identify by customer+date
    "new_date": "YYYY-MM-DD",
    "new_time": "HH:MM"
    
    // For get_schedule:
    "date": "YYYY-MM-DD" OR
    "date_from": "YYYY-MM-DD",
    "date_to": "YYYY-MM-DD"
  },
  "message": "Human-friendly message about what you're doing"
}

DATES:
- tomorrow = ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}
- day after tomorrow = ${new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]}`;

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

    // Clean up response - remove markdown code blocks
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
      console.log("Failed to parse AI response as JSON, returning as text");
      return new Response(
        JSON.stringify({ assistantMessage: assistantContent || "I'm not sure how to help with that.", action: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = parsed.action;
    const params = parsed.params || {};
    let friendlyMessage = parsed.message || "";

    // Execute actions
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
      const result = await cancelBooking(supabase, businessId, verifiedUserId, params, upcomingBookings || []);
      return new Response(
        JSON.stringify({ 
          assistantMessage: result.message, 
          action: result.success ? "cancel_booking" : null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reschedule_booking") {
      const result = await rescheduleBooking(supabase, businessId, verifiedUserId, params, openingHours || [], upcomingBookings || []);
      return new Response(
        JSON.stringify({ 
          assistantMessage: result.message, 
          action: result.success ? "reschedule_booking" : null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_schedule") {
      const result = await getSchedule(supabase, businessId, params);
      return new Response(
        JSON.stringify({ assistantMessage: result.message, action: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: just answer
    return new Response(
      JSON.stringify({ assistantMessage: friendlyMessage || "How can I help you?", action: null }),
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

// ============ HELPER FUNCTIONS ============

function findService(services: any[], name: string): any | null {
  if (!name || !services?.length) return null;
  const lower = name.toLowerCase();
  return services.find(s => s.name.toLowerCase() === lower) 
    || services.find(s => s.name.toLowerCase().includes(lower))
    || services.find(s => lower.includes(s.name.toLowerCase()));
}

function findStaff(staffList: any[], name: string): any | null {
  if (!name || !staffList?.length) return null;
  const lower = name.toLowerCase();
  return staffList.find(s => s.name.toLowerCase() === lower)
    || staffList.find(s => s.name.toLowerCase().includes(lower))
    || staffList.find(s => lower.includes(s.name.toLowerCase()));
}

function jsToDbDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function isWithinOpeningHours(openingHours: any[], date: Date, endDate: Date): { valid: boolean; reason?: string } {
  const jsDayOfWeek = date.getDay();
  const dbDayOfWeek = jsToDbDay(jsDayOfWeek);
  const hours = openingHours?.find((h: any) => h.day_of_week === dbDayOfWeek);
  
  const dbDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayName = dbDayNames[dbDayOfWeek];
  
  if (!hours) {
    return { valid: false, reason: `Opening hours not configured for ${dayName}` };
  }
  
  if (hours.is_closed) {
    return { valid: false, reason: `The business is closed on ${dayName}` };
  }
  
  const timeStr = date.toTimeString().slice(0, 5);
  const endTimeStr = endDate.toTimeString().slice(0, 5);
  
  if (timeStr < hours.open_time) {
    return { valid: false, reason: `The business opens at ${hours.open_time} on ${dayName}` };
  }
  
  if (endTimeStr > hours.close_time) {
    return { valid: false, reason: `The booking would end at ${endTimeStr}, but the business closes at ${hours.close_time} on ${dayName}` };
  }
  
  return { valid: true };
}

// Find booking by code or by customer details
function findBookingByCodeOrDetails(bookings: any[], params: any): any | null {
  const { booking_code, customer_name, customer_phone, date } = params;
  
  // Try by booking code first
  if (booking_code) {
    const code = booking_code.toUpperCase().trim();
    const found = bookings.find(b => b.booking_code?.toUpperCase() === code);
    if (found) return found;
  }
  
  // Try by customer details
  if (customer_name || customer_phone) {
    let matches = bookings;
    
    if (customer_name) {
      const nameLower = customer_name.toLowerCase();
      matches = matches.filter(b => b.customer_name.toLowerCase().includes(nameLower));
    }
    
    if (customer_phone) {
      const phoneClean = customer_phone.replace(/\D/g, "");
      matches = matches.filter(b => b.customer_phone?.replace(/\D/g, "").includes(phoneClean));
    }
    
    if (date) {
      matches = matches.filter(b => b.start_time.startsWith(date));
    }
    
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      // Return null but could suggest the user specify more
      return null;
    }
  }
  
  return null;
}

// ============ ACTION HANDLERS ============

async function createBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  services: any[],
  staffList: any[],
  openingHours: any[]
): Promise<{ success: boolean; message: string; metadata?: any }> {
  const { customer_name, customer_phone, service_name, staff_name, date, time, notes } = params;

  if (!customer_name) {
    return { success: false, message: "I need the customer's name to create a booking. Who is the appointment for?" };
  }
  if (!date || !time) {
    return { success: false, message: "I need a date and time for the booking. When would you like to schedule it?" };
  }

  const service = findService(services, service_name);
  if (service_name && !service) {
    const availableServices = services?.map(s => s.name).join(", ") || "none";
    return { success: false, message: `I couldn't find the service "${service_name}". Available services: ${availableServices}` };
  }

  const staffMember = findStaff(staffList, staff_name);
  if (staff_name && !staffMember) {
    const availableStaff = staffList?.map(s => s.name).join(", ") || "none";
    return { success: false, message: `I couldn't find staff member "${staff_name}". Available staff: ${availableStaff}` };
  }

  const startDate = new Date(`${date}T${time}:00`);
  if (isNaN(startDate.getTime())) {
    return { success: false, message: "I couldn't understand the date/time. Please use format like '2024-01-15' and '14:30'." };
  }

  if (startDate < new Date()) {
    return { success: false, message: "I can't book appointments in the past. Please choose a future date and time." };
  }

  const duration = service?.duration_minutes || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  const hoursCheck = isWithinOpeningHours(openingHours, startDate, endDate);
  if (!hoursCheck.valid) {
    return { success: false, message: `${hoursCheck.reason}. Please choose a different time.` };
  }

  // Check for conflicts
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
      const suggestedTime = new Date(startDate.getTime() + duration * 60000 + 30 * 60000);
      const suggestedStr = suggestedTime.toTimeString().slice(0, 5);
      return { 
        success: false, 
        message: `${staffMember.name} already has a booking at that time (${conflicts[0].customer_name}). Would you like to book at ${suggestedStr} instead?` 
      };
    }
  }

  console.log("Creating booking:", { businessId, customer_name, date, time, service: service?.name, staff: staffMember?.name });

  // booking_code is auto-generated by database trigger
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: customer_phone || "Not provided",
      service_id: service?.id || null,
      staff_id: staffMember?.id || null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      notes: notes || null,
      created_by: "Aivia AI",
      created_by_user_id: userId,
    })
    .select("id, booking_code")
    .single();

  if (bookingError) {
    console.error("Booking creation error:", bookingError);
    return { success: false, message: `Sorry, I couldn't create the booking: ${bookingError.message}. Please try again.` };
  }

  console.log("Booking created:", booking.id, "Code:", booking.booking_code);

  // Create/update customer (non-blocking)
  if (customer_phone && customer_phone !== "Not provided") {
    try {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", customer_phone)
        .maybeSingle();

      if (existingCustomer) {
        await supabase.from("customers").update({ name: customer_name }).eq("id", existingCustomer.id);
      } else {
        await supabase.from("customers").insert({ business_id: businessId, name: customer_name, phone: customer_phone });
      }
    } catch (e) {
      console.warn("Customer record failed (non-blocking):", e);
    }
  }

  const formattedDate = startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const formattedTime = startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  
  return { 
    success: true, 
    message: `✅ Booked! ${customer_name} with ${staffMember?.name || "any available staff"} for ${service?.name || "appointment"} on ${formattedDate} at ${formattedTime}. Booking code: ${booking.booking_code}`,
    metadata: { bookingId: booking.id, bookingCode: booking.booking_code }
  };
}

async function cancelBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  upcomingBookings: any[]
): Promise<{ success: boolean; message: string }> {
  // Find booking by code or details
  const booking = findBookingByCodeOrDetails(upcomingBookings, params);
  
  if (!booking) {
    if (params.booking_code) {
      return { success: false, message: `I couldn't find a booking with code "${params.booking_code}". Please check the code or tell me the customer's name and date.` };
    }
    if (params.customer_name) {
      return { success: false, message: `I found multiple bookings for "${params.customer_name}". Can you give me the booking code or specify the date?` };
    }
    return { success: false, message: "Which booking would you like to cancel? Please give me the booking code (like PRE-A1B2) or the customer's name and date." };
  }

  if (booking.status === "cancelled") {
    return { success: false, message: `This booking (${booking.booking_code}) is already cancelled.` };
  }

  console.log("Cancelling booking:", booking.booking_code, booking.customer_name);

  const { error } = await supabase
    .from("bookings")
    .update({ 
      status: "cancelled", 
      cancelled_at: new Date().toISOString(), 
      cancelled_by_user_id: userId 
    })
    .eq("id", booking.id);

  if (error) {
    console.error("Cancel booking error:", error);
    return { success: false, message: `Sorry, I couldn't cancel the booking: ${error.message}` };
  }

  const formattedDate = new Date(booking.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return { success: true, message: `✅ Cancelled ${booking.customer_name}'s booking (${booking.booking_code}) on ${formattedDate}.` };
}

async function rescheduleBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  openingHours: any[],
  upcomingBookings: any[]
): Promise<{ success: boolean; message: string }> {
  const { new_date, new_time } = params;

  // Find booking
  const booking = findBookingByCodeOrDetails(upcomingBookings, params);
  
  if (!booking) {
    if (params.booking_code) {
      return { success: false, message: `I couldn't find a booking with code "${params.booking_code}".` };
    }
    return { success: false, message: "Which booking would you like to reschedule? Please give me the booking code or customer details." };
  }

  if (!new_date || !new_time) {
    return { success: false, message: `Found ${booking.customer_name}'s booking (${booking.booking_code}). What date and time would you like to reschedule to?` };
  }

  if (booking.status === "cancelled") {
    return { success: false, message: "This booking is cancelled and can't be rescheduled." };
  }

  // Get service duration
  const { data: serviceData } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", booking.service_id)
    .single();

  const duration = serviceData?.duration_minutes || 60;
  const startDate = new Date(`${new_date}T${new_time}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    return { success: false, message: "I couldn't understand the new date/time." };
  }

  if (startDate < new Date()) {
    return { success: false, message: "I can't reschedule to a past time." };
  }

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
      .neq("id", booking.id)
      .neq("status", "cancelled")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflicts && conflicts.length > 0) {
      return { success: false, message: "That time slot is already taken. Please choose a different time." };
    }
  }

  console.log("Rescheduling booking:", booking.booking_code, "to", new_date, new_time);

  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      last_modified_by_user_id: userId,
    })
    .eq("id", booking.id);

  if (error) {
    console.error("Reschedule error:", error);
    return { success: false, message: "Sorry, I couldn't reschedule the booking." };
  }

  const formattedDate = startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const formattedTime = startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  
  return { 
    success: true, 
    message: `✅ Rescheduled ${booking.customer_name}'s appointment (${booking.booking_code}) to ${formattedDate} at ${formattedTime}.` 
  };
}

async function getSchedule(
  supabase: any,
  businessId: string,
  params: any
): Promise<{ message: string }> {
  const { date, date_from, date_to } = params;
  
  let fromDate = date || date_from || new Date().toISOString().split("T")[0];
  let toDate = date || date_to || fromDate;
  
  // Add one day to toDate to include the full day
  const toDateObj = new Date(toDate);
  toDateObj.setDate(toDateObj.getDate() + 1);
  
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, service:service_id(name), staff:staff_id(name)")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("start_time", fromDate)
    .lt("start_time", toDateObj.toISOString().split("T")[0])
    .order("start_time");

  if (error) {
    return { message: "Sorry, I couldn't fetch the schedule." };
  }

  if (!bookings || bookings.length === 0) {
    const dateStr = new Date(fromDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    return { message: `No bookings scheduled for ${dateStr}.` };
  }

  const dateStr = new Date(fromDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const bookingsList = bookings.map((b: any) => {
    const time = new Date(b.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `• ${time} - ${b.customer_name} with ${b.staff?.name || "TBD"} for ${b.service?.name || "appointment"} (${b.booking_code})`;
  }).join("\n");

  return { message: `📅 Schedule for ${dateStr}:\n${bookingsList}` };
}
