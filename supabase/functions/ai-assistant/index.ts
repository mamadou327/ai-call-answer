import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// AIVIA AI BOOKING ASSISTANT - Complete Rebuild
// ============================================================================
// Capabilities:
// 1. Create, cancel, reschedule bookings with full validation
// 2. Smart booking lookup (code, name, phone, date/time, partial matches)
// 3. Availability checker ("What times are free tomorrow?")
// 4. Customer memory & preferences ("Book Sarah's usual")
// 5. Business intelligence (services, hours, staff, revenue)
// 6. Natural conversation with confirmations
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  businessId: string | null;
  userId: string;
  role: "owner" | "staff" | "admin";
  messages: Message[];
}

// Day name mappings (DB stores same convention as JS Date.getDay(): Sunday=0...Saturday=6)
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function daySortKey(dayOfWeek: number): number {
  // Keep prompts Monday-first for readability
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}


// ============================================================================
// ADMIN REQUEST HANDLER
// ============================================================================

async function handleAdminRequest(
  supabase: any,
  lovableApiKey: string,
  messages: Message[],
  adminUserId: string
): Promise<Response> {
  console.log(`[Aivia Admin] Processing request from admin ${adminUserId}`);

  // Fetch comprehensive platform-wide data for admin context
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Comprehensive data fetching for admins
  const [
    { data: allBusinesses },
    { data: allStaff },
    { data: allBookings },
    { data: allServices },
    { data: allCalls },
    { data: allMessages },
    { data: allCustomers },
    { data: allProfiles },
    { data: allUserRoles },
    { data: allStaffMemberships },
    { data: pendingAdminRequests },
  ] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: false }),
    supabase.from("staff").select("*, business:business_id(business_name)").order("created_at", { ascending: false }),
    supabase.from("bookings").select("*, service:service_id(name, price), staff:staff_id(name), business:business_id(business_name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("services").select("*, business:business_id(business_name)"),
    supabase.from("calls_log").select("*, business:business_id(business_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("messages").select("*, business:business_id(business_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("*, business:business_id(business_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("*"),
    supabase.from("user_roles").select("*"),
    supabase.from("staff_memberships").select("*, business:business_id(business_name)"),
    supabase.from("profiles").select("*").eq("admin_status", "pending"),
  ]);

  // Calculate comprehensive stats
  const businesses = allBusinesses || [];
  const bookingsData = allBookings || [];
  const services = allServices || [];
  const calls = allCalls || [];
  const messagesData = allMessages || [];
  const customers = allCustomers || [];
  const staffMemberships = allStaffMemberships || [];
  
  // Calculate revenue from bookings with services
  let totalRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;
  
  bookingsData.forEach((b: any) => {
    const price = b.service?.price ? Number(b.service.price) : 0;
    totalRevenue += price;
    if (new Date(b.created_at) >= new Date(weekAgo)) weekRevenue += price;
    if (new Date(b.created_at) >= new Date(monthAgo)) monthRevenue += price;
  });

  // Status breakdowns
  const businessesByStatus = {
    approved: businesses.filter((b: any) => b.status === "approved").length,
    pending: businesses.filter((b: any) => b.status === "pending").length,
    rejected: businesses.filter((b: any) => b.status === "rejected").length,
    revoked: businesses.filter((b: any) => b.status === "revoked").length,
  };

  const bookingsByStatus = {
    confirmed: bookingsData.filter((b: any) => b.status === "confirmed").length,
    pending: bookingsData.filter((b: any) => b.status === "pending").length,
    cancelled: bookingsData.filter((b: any) => b.status === "cancelled").length,
    completed: bookingsData.filter((b: any) => b.status === "completed").length,
  };

  // Business details for reference
  const businessDetails = businesses.slice(0, 20).map((b: any) => ({
    name: b.business_name,
    status: b.status,
    phone: b.main_phone,
    address: b.address,
    website: b.website,
    staffCount: b.staff_count,
    aiviaActive: b.aivia_active,
    twilioEnabled: b.twilio_enabled,
    assignedNumber: b.assigned_aivia_number,
    createdAt: new Date(b.created_at).toLocaleDateString(),
  }));

  // Recent activity
  const recentBookings = bookingsData.slice(0, 15).map((b: any) => ({
    customer: b.customer_name,
    business: b.business?.business_name,
    service: b.service?.name,
    price: b.service?.price,
    date: new Date(b.start_time).toLocaleDateString(),
    time: new Date(b.start_time).toLocaleTimeString(),
    status: b.status,
  }));

  const recentCalls = calls.slice(0, 15).map((c: any) => ({
    business: c.business?.business_name,
    caller: c.caller_name || c.caller_phone,
    type: c.call_type,
    outcome: c.call_outcome,
    date: new Date(c.created_at).toLocaleDateString(),
  }));

  // Service pricing info
  const servicePricing = services.map((s: any) => ({
    name: s.name,
    business: s.business?.business_name,
    price: s.price,
    duration: s.duration_minutes,
  }));

  const adminSystemPrompt = `You are the Admin Assistant for the Aivia platform.
You have FULL ACCESS to all platform data and can answer ANY question about the business.

═══════════════════════════════════════════════════════════════
CURRENT DATE & TIME
═══════════════════════════════════════════════════════════════
NOW: ${now.toISOString()}
TODAY: ${todayStr}

═══════════════════════════════════════════════════════════════
PLATFORM OVERVIEW
═══════════════════════════════════════════════════════════════
BUSINESSES:
• Total: ${businesses.length}
• Approved: ${businessesByStatus.approved}
• Pending Approval: ${businessesByStatus.pending}
• Rejected: ${businessesByStatus.rejected}
• Revoked: ${businessesByStatus.revoked}

USERS & STAFF:
• Total Staff Members: ${(allStaff || []).length}
• Staff Memberships: ${staffMemberships.length}
• Active Memberships: ${staffMemberships.filter((m: any) => m.status === "active").length}
• Pending Memberships: ${staffMemberships.filter((m: any) => m.status === "pending_approval").length}
• User Profiles: ${(allProfiles || []).length}
• User Roles Assigned: ${(allUserRoles || []).length}
• Pending Admin Requests: ${(pendingAdminRequests || []).length}

BOOKINGS:
• Total: ${bookingsData.length}
• Confirmed: ${bookingsByStatus.confirmed}
• Pending: ${bookingsByStatus.pending}
• Completed: ${bookingsByStatus.completed}
• Cancelled: ${bookingsByStatus.cancelled}

REVENUE:
• Total Revenue (all time): £${totalRevenue.toFixed(2)}
• Revenue This Month: £${monthRevenue.toFixed(2)}
• Revenue This Week: £${weekRevenue.toFixed(2)}

COMMUNICATIONS:
• Total Calls Logged: ${calls.length}
• Total Messages: ${messagesData.length}
• Total Customers: ${customers.length}

SERVICES:
• Total Services Offered: ${services.length}

═══════════════════════════════════════════════════════════════
BUSINESS DIRECTORY (Top 20)
═══════════════════════════════════════════════════════════════
${businessDetails.map((b: any) => `• ${b.name} | ${b.status} | ${b.phone} | Staff: ${b.staffCount} | Aivia: ${b.aiviaActive ? "Active" : "Inactive"} | Created: ${b.createdAt}`).join("\n")}

═══════════════════════════════════════════════════════════════
RECENT BOOKINGS (Last 15)
═══════════════════════════════════════════════════════════════
${recentBookings.map((b: any) => `• ${b.customer} @ ${b.business} | ${b.service || "No service"} | £${b.price || 0} | ${b.date} ${b.time} | ${b.status}`).join("\n")}

═══════════════════════════════════════════════════════════════
RECENT CALLS (Last 15)
═══════════════════════════════════════════════════════════════
${recentCalls.map((c: any) => `• ${c.business} | ${c.caller} | ${c.type} | ${c.outcome || "No outcome"} | ${c.date}`).join("\n")}

═══════════════════════════════════════════════════════════════
SERVICE PRICING
═══════════════════════════════════════════════════════════════
${servicePricing.map((s: any) => `• ${s.name} @ ${s.business} | £${s.price} | ${s.duration}min`).join("\n")}

═══════════════════════════════════════════════════════════════
YOUR CAPABILITIES (UNLIMITED ACCESS)
═══════════════════════════════════════════════════════════════

You can answer ANY question about the platform including:

1. BUSINESS DATA
   - Business details, status, settings
   - Contact info, addresses, websites
   - Twilio/MessageBird configuration
   - Staff assignments

2. FINANCIAL DATA
   - Revenue breakdowns by period
   - Service pricing
   - Booking values

3. USER DATA
   - User counts and roles
   - Staff memberships
   - Admin requests
   - Customer data

4. ACTIVITY DATA
   - Bookings (all statuses)
   - Call logs
   - Messages
   - Customer interactions

5. SYSTEM STATUS
   - Integration status (Aivia, Twilio, etc.)
   - Pending approvals
   - Platform health

6. GENERAL QUESTIONS
   - You can research and provide helpful answers on ANY topic
   - Use your knowledge to help with business questions
   - Provide guidance and recommendations

═══════════════════════════════════════════════════════════════
RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════

- Answer any question asked, using the data provided above
- Be helpful, accurate, and comprehensive
- Format data clearly with bullet points
- Include specific numbers and details
- If the data above doesn't contain what's needed, say so but try to help
- You are a powerful admin assistant - act like one!
`;

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/o3",
        messages: [
          { role: "system", content: adminSystemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[Aivia Admin] AI Gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ assistantMessage: "I'm having trouble processing your request. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ assistantMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Aivia Admin] Error:", error);
    return new Response(
      JSON.stringify({ assistantMessage: "An error occurred. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { businessId, userId, role, messages }: RequestBody = await req.json();

    if (!userId || !messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ assistantMessage: "Missing required fields", action: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin role doesn't require businessId
    if (role !== "admin" && !businessId) {
      return new Response(
        JSON.stringify({ assistantMessage: "Business ID required for non-admin roles", action: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========== AUTHORIZATION ===========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized", action: null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized", action: null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========== ADMIN ROLE HANDLING ===========
    if (role === "admin") {
      // Check if user has admin role
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["super_admin", "sub_admin"]);

      if (!adminRoles || adminRoles.length === 0) {
        return new Response(
          JSON.stringify({ assistantMessage: "Unauthorized - Admin access required", action: null }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle admin-specific queries
      return await handleAdminRequest(supabase, lovableApiKey, messages, user.id);
    }

    // =========== BUSINESS USER AUTHORIZATION ===========
    // Check access for business-specific operations
    const [{ data: ownerCheck }, { data: staffCheck }] = await Promise.all([
      supabase.from("businesses").select("id").eq("id", businessId).eq("owner_id", user.id).single(),
      supabase.from("staff_memberships").select("id").eq("business_id", businessId).eq("user_id", user.id).eq("status", "active").single(),
    ]);

    if (!ownerCheck && !staffCheck) {
      return new Response(
        JSON.stringify({ assistantMessage: "Unauthorized", action: null }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // At this point, businessId is guaranteed to be non-null (checked earlier for non-admin roles)
    const validBusinessId = businessId as string;
    const verifiedUserId = user.id;
    console.log(`[Aivia] User ${verifiedUserId} accessing business ${validBusinessId}`);

    // =========== FETCH BUSINESS CONTEXT ===========
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [
      { data: business },
      { data: businessSettings },
      { data: customerSettings },
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: upcomingBookings },
      { data: allBookings }, // Include cancelled bookings for lookup
      { data: recentBookings },
      { data: customers },
      { data: staffTimeOff }, // Staff time off data
    ] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", validBusinessId).single(),
      supabase.from("business_settings").select("*").eq("business_id", validBusinessId).single(),
      supabase.from("customer_settings").select("*").eq("business_id", validBusinessId).single(),
      supabase.from("services").select("*").eq("business_id", validBusinessId).order("name"),
      supabase.from("staff").select("*").eq("business_id", validBusinessId).order("name"),
      supabase.from("opening_hours").select("*").eq("business_id", validBusinessId).order("day_of_week"),
      // Non-cancelled upcoming bookings for display
      supabase
        .from("bookings")
        .select("*, service:service_id(id, name, duration_minutes, price), staff:staff_id(id, name)")
        .eq("business_id", validBusinessId)
        .neq("status", "cancelled")
        .gte("start_time", todayStr)
        .order("start_time")
        .limit(100),
      // ALL bookings (including cancelled) for lookups
      supabase
        .from("bookings")
        .select("*, service:service_id(id, name, duration_minutes, price), staff:staff_id(id, name)")
        .eq("business_id", validBusinessId)
        .gte("start_time", weekAgo)
        .order("start_time", { ascending: false })
        .limit(200),
      supabase
        .from("bookings")
        .select("id, customer_name, service_id, staff_id, start_time, status")
        .eq("business_id", validBusinessId)
        .gte("start_time", weekAgo)
        .lt("start_time", todayStr)
        .order("start_time", { ascending: false })
        .limit(50),
      supabase
        .from("customers")
        .select("id, name, phone, email, preferred_staff_id, notes_preferences, total_visits")
        .eq("business_id", validBusinessId)
        .order("total_visits", { ascending: false })
        .limit(100),
      // Fetch staff time off (approved, current and future)
      supabase
        .from("staff_time_off")
        .select("id, staff_id, start_time, end_time, reason")
        .eq("business_id", validBusinessId)
        .eq("status", "approved")
        .gte("end_time", todayStr),
    ]);

    // Extract policy settings with defaults
    const policies = {
      minBookingNoticeHours: businessSettings?.min_booking_notice_hours || 2,
      maxDaysAdvance: businessSettings?.max_days_advance || 30,
      minCancellationNoticeHours: businessSettings?.min_cancellation_notice_hours || 24,
      cancellationPolicy: businessSettings?.cancellation_policy || "No specific policy set",
    };

    // Extract assistant settings
    const assistantConfig = {
      name: businessSettings?.assistant_name || "Aivia",
      tone: businessSettings?.tone || "neutral",
      language: businessSettings?.primary_language || "English",
      currency: businessSettings?.currency || "GBP",
      country: businessSettings?.country || "United Kingdom",
    };

    // Extract customer data collection settings
    const customerDataSettings = {
      collectName: customerSettings?.collect_name ?? true,
      collectPhone: customerSettings?.collect_phone ?? true,
      collectEmail: customerSettings?.collect_email ?? false,
      askHowHeard: customerSettings?.ask_how_heard ?? false,
      askMarketingConsent: customerSettings?.ask_marketing_consent ?? false,
      askNotesPreferences: customerSettings?.ask_notes_preferences ?? false,
      askPreferredStaff: customerSettings?.ask_preferred_staff ?? false,
    };

    // Extract business knowledge
    const businessKnowledge = business?.website_knowledge || null;

    // =========== BUILD CONTEXT ===========
    const jsDayToday = now.getDay();

    const formattedHours = (openingHours ?? [])
      .slice()
      .sort((a: any, b: any) => daySortKey(a.day_of_week) - daySortKey(b.day_of_week))
      .map((h: any) => ({
        day: DAY_NAMES[h.day_of_week],
        dayOfWeek: h.day_of_week,
        isClosed: h.is_closed,
        open: h.open_time,
        close: h.close_time,
      }));


    const formattedBookings = upcomingBookings?.map((b: any) => ({
      code: b.booking_code,
      id: b.id,
      customer: b.customer_name,
      phone: b.customer_phone,
      date: new Date(b.start_time).toISOString().split("T")[0],
      time: new Date(b.start_time).toTimeString().slice(0, 5),
      endTime: new Date(b.end_time).toTimeString().slice(0, 5),
      staffId: b.staff?.id,
      staffName: b.staff?.name || "unassigned",
      serviceId: b.service?.id,
      serviceName: b.service?.name || "appointment",
      duration: b.service?.duration_minutes || 60,
      status: b.status,
    })) || [];

    // Format ALL bookings (including cancelled) for lookups
    const formattedAllBookings = allBookings?.map((b: any) => ({
      code: b.booking_code,
      id: b.id,
      customer: b.customer_name,
      phone: b.customer_phone,
      date: new Date(b.start_time).toISOString().split("T")[0],
      time: new Date(b.start_time).toTimeString().slice(0, 5),
      endTime: new Date(b.end_time).toTimeString().slice(0, 5),
      staffId: b.staff?.id,
      staffName: b.staff?.name || "unassigned",
      serviceId: b.service?.id,
      serviceName: b.service?.name || "appointment",
      duration: b.service?.duration_minutes || 60,
      status: b.status,
    })) || [];

    const formattedCustomers = customers?.map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      preferredStaffId: c.preferred_staff_id,
      notes: c.notes_preferences,
      visits: c.total_visits,
    })) || [];

    // Calculate helper dates
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // =========== SYSTEM PROMPT ===========
    const systemPrompt = `You are ${assistantConfig.name}, an intelligent AI booking assistant for "${business?.business_name || "this business"}".
You help ${role === "owner" ? "the business owner" : "staff"} manage bookings efficiently and naturally.

═══════════════════════════════════════════════════════════════
YOUR PERSONALITY & COMMUNICATION STYLE
═══════════════════════════════════════════════════════════════
• Your Name: ${assistantConfig.name}
• Tone: ${assistantConfig.tone === "casual" ? "Casual and friendly - use relaxed, approachable language" : assistantConfig.tone === "formal" ? "Formal and professional - use polite, business-appropriate language" : "Neutral and balanced - clear, professional but approachable"}
• Language: ${assistantConfig.language}
• Currency: ${assistantConfig.currency}
• Country/Region: ${assistantConfig.country}

IMPORTANT: Always communicate in the style matching your tone setting!

═══════════════════════════════════════════════════════════════
CURRENT CONTEXT
═══════════════════════════════════════════════════════════════
NOW: ${now.toISOString()}
TODAY: ${DAY_NAMES[jsDayToday]}, ${todayStr}
TOMORROW: ${tomorrow.toISOString().split("T")[0]}
DAY AFTER: ${dayAfterTomorrow.toISOString().split("T")[0]}

═══════════════════════════════════════════════════════════════
BUSINESS DETAILS (YOU KNOW THIS BUSINESS!)
═══════════════════════════════════════════════════════════════
• Business Name: ${business?.business_name}
• Address: ${business?.address}
• Main Phone: ${business?.main_phone}
${business?.secondary_phone ? `• Secondary Phone: ${business.secondary_phone}` : ""}
${business?.website ? `• Website: ${business.website}` : ""}

CRITICAL: If any other text (including Website Knowledge) conflicts with the address or opening days above, treat BUSINESS DETAILS + OPENING HOURS as the source of truth.

${businessKnowledge ? `
═══════════════════════════════════════════════════════════════
WEBSITE KNOWLEDGE (Learned from business website)
═══════════════════════════════════════════════════════════════
${businessKnowledge}
` : ""}

═══════════════════════════════════════════════════════════════
SERVICES & PRICING
═══════════════════════════════════════════════════════════════
${services?.map((s: any) => `• ${s.name} | ${s.duration_minutes}min | ${assistantConfig.currency === "GBP" ? "£" : assistantConfig.currency === "EUR" ? "€" : "$"}${s.price}${s.description ? ` - ${s.description}` : ""}`).join("\n") || "No services configured"}

═══════════════════════════════════════════════════════════════
STAFF MEMBERS
═══════════════════════════════════════════════════════════════
${staff?.map((s: any) => `• ${s.name} (${s.role})${s.title ? ` - ${s.title}` : ""}${s.ai_enabled ? "" : " [AI booking disabled]"}`).join("\n") || "No staff configured"}

═══════════════════════════════════════════════════════════════
OPENING HOURS (STRICTLY ENFORCE THESE!)
═══════════════════════════════════════════════════════════════
${formattedHours.map((h: any) => `• ${h.day}: ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured - ask business owner to set opening hours"}

CRITICAL: Do NOT allow bookings outside these hours! If a day shows CLOSED, the business is NOT open!

═══════════════════════════════════════════════════════════════
CUSTOMER DATA COLLECTION RULES
═══════════════════════════════════════════════════════════════
When taking bookings, you MUST collect this information:
${customerDataSettings.collectName ? "• Customer Name (REQUIRED)" : ""}
${customerDataSettings.collectPhone ? "• Phone Number (REQUIRED)" : ""}
${customerDataSettings.collectEmail ? "• Email Address (REQUIRED)" : ""}
${customerDataSettings.askHowHeard ? "• Ask how they heard about us" : ""}
${customerDataSettings.askMarketingConsent ? "• Ask for marketing consent" : ""}
${customerDataSettings.askNotesPreferences ? "• Ask for any special notes or preferences" : ""}
${customerDataSettings.askPreferredStaff ? "• Ask if they have a preferred staff member" : ""}

═══════════════════════════════════════════════════════════════
UPCOMING BOOKINGS (${formattedBookings.length} total)
═══════════════════════════════════════════════════════════════
${formattedBookings.slice(0, 30).map((b: any) => 
  `• ${b.code} | ${b.customer} | ${b.date} ${b.time} | ${b.staffName} | ${b.serviceName}`
).join("\n") || "No upcoming bookings"}

═══════════════════════════════════════════════════════════════
TOP CUSTOMERS (by visits)
═══════════════════════════════════════════════════════════════
${formattedCustomers.slice(0, 15).map((c: any) => 
  `• ${c.name}${c.phone ? ` (${c.phone})` : ""} | ${c.visits} visits${c.notes ? ` | Pref: ${c.notes}` : ""}`
).join("\n") || "No customers yet"}

═══════════════════════════════════════════════════════════════
BOOKING POLICIES (YOU MUST ENFORCE THESE - NO EXCEPTIONS!)
═══════════════════════════════════════════════════════════════
• Minimum Booking Notice: ${policies.minBookingNoticeHours} hours in advance
  → Customers CANNOT book less than ${policies.minBookingNoticeHours} hours before the appointment
• Maximum Advance Booking: ${policies.maxDaysAdvance} days ahead
  → Customers CANNOT book more than ${policies.maxDaysAdvance} days in the future
• Minimum Cancellation Notice: ${policies.minCancellationNoticeHours} hours before appointment
  → Customers CANNOT cancel within ${policies.minCancellationNoticeHours} hours of their appointment
• Cancellation Policy: ${policies.cancellationPolicy}

CRITICAL: These policies are STRICT and MUST be enforced. Do NOT allow ANY exceptions!

═══════════════════════════════════════════════════════════════
⚠️ PRE-FLIGHT VALIDATION CHECKLIST ⚠️
(YOU MUST RUN THROUGH THIS BEFORE EVERY BOOKING REQUEST!)
═══════════════════════════════════════════════════════════════

Before answering ANY booking-related question, ALWAYS validate in this EXACT order:

📋 STEP 1: DATE VALIDATION
   □ What is the requested date?
   □ What day of the week is it? (Monday=0, Tuesday=1, etc.)
   □ Is this date in the past? → REJECT if yes
   □ How many days from today? Calculate: (requested_date - today)
   □ Is it within ${policies.maxDaysAdvance} days? → REJECT if more

📋 STEP 2: DAY/HOURS VALIDATION
   □ Check OPENING HOURS for that specific day
   □ Is the business CLOSED on that day? → REJECT if yes
   □ What are the open/close times for that day?
   □ Is the requested time WITHIN open hours? → REJECT if outside

📋 STEP 3: NOTICE PERIOD VALIDATION
   □ Calculate exact time difference: (requested_datetime - NOW)
   □ Convert to hours
   □ Is it at least ${policies.minBookingNoticeHours} hours from now? → REJECT if less
   □ For cancellations: Is it at least ${policies.minCancellationNoticeHours} hours before? → REJECT if less

📋 STEP 4: STAFF TIME OFF VALIDATION (CRITICAL!)
   □ Check if the requested staff member is on TIME OFF
   □ Is the staff member on approved time off during this slot? → REJECT or suggest alternative staff
   □ ALWAYS check time off BEFORE confirming any availability!

📋 STEP 5: BOOKING CONFLICT VALIDATION
   □ Check existing bookings for that date/time
   □ Is the requested staff member already booked? → REJECT or suggest alternative
   □ Would the booking overlap with existing ones? → REJECT

📋 STEP 6: SERVICE/STAFF VALIDATION
   □ Does the requested service exist?
   □ Is the requested staff member AI-enabled for bookings?
   □ Can this staff member provide this service?

ALWAYS explain your reasoning! Example response pattern:
"Let me check that for you...
✓ Date: [date] is a [day] - we're OPEN from [open] to [close]
✓ Time: [time] is within our hours
✓ Notice: That's [X] hours from now, which meets our ${policies.minBookingNoticeHours}-hour minimum
✓ Time Off: [staff] is working (not on time off)
✓ Bookings: [staff] has no conflicting bookings
→ Yes, I can book that for you!"

OR if rejecting:
"I'm sorry, but I can't book that because:
✗ [specific reason - e.g., staff is on time off / already booked]
→ Here's what I can offer instead: [alternative staff who ARE available]"

═══════════════════════════════════════════════════════════════
YOUR CAPABILITIES
═══════════════════════════════════════════════════════════════

1. CREATE BOOKING
   - Book appointments with validation
   - Prevent double-booking
   - Check opening hours
   - ENFORCE minimum ${policies.minBookingNoticeHours} hours notice
   - ENFORCE maximum ${policies.maxDaysAdvance} days in advance

2. CANCEL BOOKING
   - Find by code, name, phone, date
   - Always confirm before cancelling
   - ENFORCE minimum ${policies.minCancellationNoticeHours} hours cancellation notice
   - If within notice period, explain the policy and refuse

3. RESCHEDULE BOOKING
   - Move to new date/time
   - Validate new slot
   - Check both original cancellation policy AND new booking policy

4. CHECK AVAILABILITY
   - "What times are free tomorrow?"
   - "When is [staff] available on [date]?"
   - Suggest open slots

5. VIEW SCHEDULE
   - Show bookings for a date/range
   - Filter by staff

6. CUSTOMER LOOKUP
   - "Book Sarah's usual" → Find her preferences
   - Update customer info

7. BUSINESS QUESTIONS
   - Services, pricing, hours
   - Staff info

8. REVENUE/STATS (owner only)
   - "How many bookings this week?"
   - Basic stats

═══════════════════════════════════════════════════════════════
CRITICAL RULES - READ CAREFULLY!
═══════════════════════════════════════════════════════════════

1. ALWAYS respond with valid JSON - never plain text!

2. NEVER allow bookings for times that have ALREADY PASSED!
   - If someone tries to book for a time earlier than NOW (${now.toISOString()}), REFUSE!
   - Check: is the requested time AFTER the current time? If not, reject it!
   - Example: If it's 17:00 and they want to book for 16:00 today, say NO!

3. For cancel/reschedule with a NAME:
   → IMMEDIATELY try the action with that name
   → The backend will search and return results
   → DO NOT ask for phone first!

4. ALWAYS confirm before destructive actions

5. Be helpful and natural - suggest alternatives if something won't work

6. Reference bookings by CODE (like PRE-2647), not internal IDs

7. ⚠️ RESCHEDULE vs CREATE - THIS IS CRITICAL! ⚠️
   
   RESCHEDULE means MOVE AN EXISTING BOOKING to a new time/date.
   - Keywords: "reschedule", "move", "change time", "change date", "move to", "switch to"
   - Action: "reschedule_booking" - NEVER "create_booking"!
   - You MUST find the existing booking FIRST, then update its time
   - NEVER create a new booking when user wants to reschedule!
   
   CREATE means make a BRAND NEW booking for someone.
   - Keywords: "book", "make appointment", "schedule", "new booking"
   - Action: "create_booking"
   - Only use when user explicitly wants a NEW appointment
   
   EXAMPLES:
   ✅ "Reschedule Sarah to 3pm" → {"action":"reschedule_booking","params":{"customer_name":"Sarah","new_time":"15:00"}}
   ✅ "Move James to tomorrow" → {"action":"reschedule_booking","params":{"customer_name":"James","new_date":"..."}}
   ❌ WRONG: "Reschedule Sarah" → {"action":"create_booking"} ← NEVER DO THIS!
   
   ASK YOURSELF: Does the user want to MOVE an existing booking or CREATE a new one?
   If they mention reschedule/move/change → Use reschedule_booking
   If they want something new → Use create_booking

8. DOUBLE-BOOKING PREVENTION:
   - Before confirming ANY booking, check if the staff member already has a booking at that time
   - Check the UPCOMING BOOKINGS list below - if staff has a booking overlapping, REFUSE!
   - A staff member CANNOT have two bookings at the same time

═══════════════════════════════════════════════════════════════
SMART BOOKING LOOKUP
═══════════════════════════════════════════════════════════════

When looking up bookings, try these in order:
1. booking_code: Exact match (e.g., "PRE-2647")
2. booking_code_suffix: Last 4 digits (e.g., "2647")
3. customer_name: Fuzzy name match
4. customer_name + date: Name on specific date
5. customer_name + date + time: Most precise

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (ALWAYS USE JSON)
═══════════════════════════════════════════════════════════════

{
  "action": "create_booking" | "cancel_booking" | "reschedule_booking" | 
            "check_availability" | "get_schedule" | "customer_lookup" | 
            "get_stats" | "answer",
  "params": { ... },
  "message": "Human-friendly message"
}

ACTION PARAMETERS:

create_booking:
  customer_name (required), customer_phone, service_name, staff_name, 
  date (YYYY-MM-DD), time (HH:MM), notes

cancel_booking:
  booking_code OR booking_code_suffix OR customer_name
  date, time (optional, helps narrow down)

reschedule_booking:
  booking_code OR booking_code_suffix OR customer_name
  new_date (YYYY-MM-DD), new_time (HH:MM)

check_availability:
  date (YYYY-MM-DD), staff_name (optional), duration_minutes (optional)

get_schedule:
  date OR date_from + date_to, staff_name (optional)

customer_lookup:
  customer_name OR customer_phone

get_stats:
  period: "today" | "week" | "month"

answer:
  (no params needed, just the message)

═══════════════════════════════════════════════════════════════
EXAMPLES WITH REASONING
═══════════════════════════════════════════════════════════════

User: "Can I book for 3pm today?" (Current time: 2:30pm, min notice: 1 hour)
REASONING: 3pm is only 30 minutes away. 30 mins < 1 hour minimum notice.
→ {"action":"answer","params":{},"message":"I'm sorry, but I can't book for 3pm today. That's only 30 minutes from now, and we require at least 1 hour's notice for bookings. The earliest I can book you in today would be 3:30pm. Would that work?"}

User: "Book me for February 13th 2026" (Today: December 15th 2025, max advance: 30 days)
REASONING: Feb 13th 2026 is ~60 days away. 60 days > 30 days max advance. Also need to check what day that is.
→ {"action":"answer","params":{},"message":"I'm sorry, but we can only take bookings up to 30 days in advance. February 13th is about 60 days away. Would you like to book for a date within the next 30 days instead?"}

User: "Cancel James booking" (booking is tomorrow at 10am, current time 9am, min cancel notice: ${policies.minCancellationNoticeHours} hours)
REASONING: James has booking tomorrow 10am. Current time is today 9am. That's 25 hours from now. ${policies.minCancellationNoticeHours} hour minimum required. 25 > ${policies.minCancellationNoticeHours} ✓ Can cancel.
→ {"action":"cancel_booking","params":{"customer_name":"James"},"message":"Let me find James's booking. His appointment is tomorrow at 10am, which is 25 hours from now. Since we require ${policies.minCancellationNoticeHours} hours notice for cancellations, this is within policy and I can cancel it for you."}

User: "Cancel my appointment" (booking is today at 4pm, current time 2pm, min cancel notice: ${policies.minCancellationNoticeHours} hours)
REASONING: Booking is at 4pm today. Current time is 2pm. That's only 2 hours from now. ${policies.minCancellationNoticeHours} hour minimum required. 2 < ${policies.minCancellationNoticeHours} ✗ Cannot cancel.
→ {"action":"answer","params":{},"message":"I'm sorry, but I can't cancel your 4pm appointment. It's only 2 hours away, and our cancellation policy requires at least ${policies.minCancellationNoticeHours} hours notice. ${policies.cancellationPolicy}. If this is an emergency, please call the business directly."}

User: "What times are free tomorrow?"
→ {"action":"check_availability","params":{"date":"${tomorrow.toISOString().split("T")[0]}"},"message":"Let me check availability for tomorrow. First I'll verify we're open and then find free slots..."}

User: "Book me for Sunday at 2pm" (Sunday is CLOSED)
REASONING: Check opening hours - Sunday shows CLOSED.
→ {"action":"answer","params":{},"message":"I'm sorry, but we're closed on Sundays. We're open Monday through Saturday. Would you like to book for another day?"}

User: "I want a refund"
REASONING: Check cancellation policy to provide accurate answer.
→ {"action":"answer","params":{},"message":"${policies.cancellationPolicy}. Is there anything else I can help you with?"}

REMEMBER: ALWAYS respond with JSON. Never plain text.`;

    // =========== CALL AI ===========
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/o3",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[Aivia] AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ assistantMessage: "I'm a bit busy right now. Please try again in a moment.", action: null }),
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
    let content = aiData.choices?.[0]?.message?.content || "";
    
    console.log("[Aivia] Raw AI response:", content);

    // Clean markdown
    content = content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    else if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.log("[Aivia] Failed to parse JSON, returning as text");
      return new Response(
        JSON.stringify({ assistantMessage: content || "How can I help?", action: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const action = parsed.action;
    const params = parsed.params || {};
    const friendlyMessage = parsed.message || "";

    // =========== EXECUTE ACTIONS ===========
    
    // CREATE BOOKING
    if (action === "create_booking") {
      const result = await handleCreateBooking(supabase, validBusinessId, verifiedUserId, params, {
        services: services || [],
        staff: staff || [],
        openingHours: openingHours || [],
        bookings: formattedBookings,
        policies,
        staffTimeOff: staffTimeOff || [],
      });
      return jsonResponse(result);
    }

    // CANCEL BOOKING - use allBookings to find cancelled ones too
    if (action === "cancel_booking") {
      const result = await handleCancelBooking(supabase, validBusinessId, verifiedUserId, params, formattedAllBookings, allBookings || [], policies);
      return jsonResponse(result);
    }

    // RESCHEDULE BOOKING - use allBookings to find cancelled ones too
    if (action === "reschedule_booking") {
      const result = await handleRescheduleBooking(supabase, validBusinessId, verifiedUserId, params, {
        openingHours: openingHours || [],
        bookings: formattedAllBookings,
        rawBookings: allBookings || [],
      });
      return jsonResponse(result);
    }

    // CHECK AVAILABILITY
    if (action === "check_availability") {
      const result = handleCheckAvailability(params, {
        openingHours: openingHours || [],
        bookings: formattedBookings,
        staff: staff || [],
        staffTimeOff: staffTimeOff || [],
      });
      return jsonResponse({ assistantMessage: result, action: null });
    }

    // GET SCHEDULE
    if (action === "get_schedule") {
      const result = await handleGetSchedule(supabase, validBusinessId, params);
      return jsonResponse({ assistantMessage: result, action: null });
    }

    // CUSTOMER LOOKUP
    if (action === "customer_lookup") {
      const result = handleCustomerLookup(params, formattedCustomers, services || [], staff || []);
      return jsonResponse({ assistantMessage: result, action: null });
    }

    // GET STATS
    if (action === "get_stats") {
      const result = await handleGetStats(supabase, validBusinessId, params);
      return jsonResponse({ assistantMessage: result, action: null });
    }

    // DEFAULT: Answer
    return jsonResponse({ assistantMessage: friendlyMessage || "How can I help you today?", action: null });

  } catch (error) {
    console.error("[Aivia] Error:", error);
    return new Response(
      JSON.stringify({ assistantMessage: "Something went wrong. Please try again.", action: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function findService(services: any[], name: string): any | null {
  if (!name || !services?.length) return null;
  const lower = name.toLowerCase().trim();
  return services.find(s => s.name.toLowerCase() === lower)
    || services.find(s => s.name.toLowerCase().includes(lower))
    || services.find(s => lower.includes(s.name.toLowerCase()));
}

function findStaff(staffList: any[], name: string): any | null {
  if (!name || !staffList?.length) return null;
  const lower = name.toLowerCase().trim();
  return staffList.find(s => s.name.toLowerCase() === lower)
    || staffList.find(s => s.name.toLowerCase().includes(lower))
    || staffList.find(s => lower.includes(s.name.toLowerCase()));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatBookingSummary(b: any): string {
  return `${b.code} – ${b.customer} – ${b.serviceName} – ${b.staffName} – ${b.date} at ${b.time}`;
}

// ============================================================================
// SMART BOOKING LOOKUP
// ============================================================================

interface LookupResult {
  found: boolean;
  booking?: any;
  rawBooking?: any;
  candidates?: any[];
  message?: string;
}

function smartBookingLookup(bookings: any[], rawBookings: any[], params: any): LookupResult {
  const { booking_code, booking_code_suffix, customer_name, customer_phone, date, time } = params;

  // 1. Exact booking code
  if (booking_code) {
    const code = booking_code.toUpperCase().trim();
    const idx = bookings.findIndex(b => b.code?.toUpperCase() === code);
    if (idx >= 0) {
      return { found: true, booking: bookings[idx], rawBooking: rawBookings[idx] };
    }
    return { found: false, message: `I couldn't find a booking with code "${booking_code}". Can you check the code or give me the customer's name?` };
  }

  // 2. Suffix match (last 4 digits)
  if (booking_code_suffix) {
    const suffix = booking_code_suffix.trim().toUpperCase();
    const matches: number[] = [];
    bookings.forEach((b, i) => {
      if (b.code?.endsWith(suffix) || b.code?.endsWith(`-${suffix}`)) matches.push(i);
    });

    if (matches.length === 1) {
      return { found: true, booking: bookings[matches[0]], rawBooking: rawBookings[matches[0]] };
    }
    if (matches.length > 1) {
      const candidates = matches.map(i => bookings[i]);
      return {
        found: false,
        candidates,
        message: `I found ${matches.length} bookings ending with "${suffix}":\n${candidates.map((b, i) => `${i + 1}) ${formatBookingSummary(b)}`).join("\n")}\n\nWhich one did you mean? Tell me the full code.`,
      };
    }
    return { found: false, message: `No booking found ending with "${suffix}". Can you give me the full code or the customer's name?` };
  }

  // 3. Customer name search
  if (customer_name) {
    const nameLower = customer_name.toLowerCase().trim();
    let matchIndices = bookings
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.customer.toLowerCase().includes(nameLower))
      .map(({ i }) => i);

    // Narrow by date
    if (date && matchIndices.length > 1) {
      const dateMatches = matchIndices.filter(i => bookings[i].date === date);
      if (dateMatches.length > 0) matchIndices = dateMatches;
    }

    // Narrow by approximate time
    if (time && matchIndices.length > 1) {
      const requestedHour = parseInt(time.split(":")[0]);
      const timeMatches = matchIndices.filter(i => {
        const bookingHour = parseInt(bookings[i].time.split(":")[0]);
        return Math.abs(bookingHour - requestedHour) <= 2;
      });
      if (timeMatches.length > 0) matchIndices = timeMatches;
    }

    // Narrow by phone
    if (customer_phone && matchIndices.length > 1) {
      const phoneClean = customer_phone.replace(/\D/g, "");
      const phoneMatches = matchIndices.filter(i => 
        bookings[i].phone?.replace(/\D/g, "").includes(phoneClean)
      );
      if (phoneMatches.length > 0) matchIndices = phoneMatches;
    }

    if (matchIndices.length === 1) {
      return { found: true, booking: bookings[matchIndices[0]], rawBooking: rawBookings[matchIndices[0]] };
    }
    if (matchIndices.length > 1) {
      const candidates = matchIndices.map(i => bookings[i]);
      return {
        found: false,
        candidates,
        message: `I found ${matchIndices.length} bookings for "${customer_name}":\n${candidates.map((b, i) => `${i + 1}) ${formatBookingSummary(b)}`).join("\n")}\n\nWhich one? Tell me the booking code.`,
      };
    }
    return { found: false, message: `No upcoming booking found for "${customer_name}". Can you give me the booking code or check the name?` };
  }

  return { found: false, message: "Please give me a booking code or customer name so I can find the booking." };
}

// ============================================================================
// OPENING HOURS VALIDATION
// ============================================================================

function getOpeningHoursForDate(
  openingHours: any[],
  dateStr: string
): { open: string; close: string; dayName: string } | null {
  // Parse the date string to get the day of week
  const dateParts = dateStr.split("-");
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
  const day = parseInt(dateParts[2]);

  // Create date in a way that doesn't involve timezone conversion
  const tempDate = new Date(year, month, day);
  const jsDay = tempDate.getDay(); // 0=Sunday..6=Saturday (matches stored day_of_week)
  const dayName = DAY_NAMES[jsDay];

  console.log(`[Aivia] Opening hours check - Date: ${dateStr}, JS Day: ${jsDay}, Day Name: ${dayName}`);

  const hours = openingHours.find((h) => h.day_of_week === jsDay);

  if (!hours) {
    console.log(`[Aivia] No opening hours found for day ${jsDay}`);
    return null;
  }

  if (hours.is_closed) {
    console.log(`[Aivia] Business is CLOSED on ${dayName}`);
    return null;
  }

  // Extract just the time portion (HH:MM) from the stored time
  const openTime = hours.open_time?.slice(0, 5) || null;
  const closeTime = hours.close_time?.slice(0, 5) || null;

  console.log(`[Aivia] Opening hours for ${dayName}: ${openTime} - ${closeTime}`);

  return { open: openTime, close: closeTime, dayName };
}


function isWithinOpeningHours(openingHours: any[], dateStr: string, startTime: string, endTime: string): { valid: boolean; reason?: string } {
  const hours = getOpeningHoursForDate(openingHours, dateStr);

  if (!hours) {
    // Determine the day name for the error message
    const dateParts = dateStr.split('-');
    const tempDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayName = DAY_NAMES[tempDate.getDay()];
    return { valid: false, reason: `We're closed on ${dayName}` };
  }

  console.log(`[Aivia] Validating time - Start: ${startTime}, End: ${endTime}, Open: ${hours.open}, Close: ${hours.close}`);

  if (startTime < hours.open) {
    return { valid: false, reason: `We open at ${hours.open} on ${hours.dayName}. Your requested time ${startTime} is before we open` };
  }
  if (endTime > hours.close) {
    return { valid: false, reason: `We close at ${hours.close} on ${hours.dayName}, but this booking would end at ${endTime}` };
  }

  return { valid: true };
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleCreateBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  context: { services: any[]; staff: any[]; openingHours: any[]; bookings: any[]; policies: any; staffTimeOff: any[] }
): Promise<{ assistantMessage: string; action: string | null; metadata?: any }> {
  const { customer_name, customer_phone, service_name, staff_name, date, time, notes } = params;
  const { policies } = context;

  // Validation
  if (!customer_name) {
    return { assistantMessage: "Who is this booking for? I need the customer's name.", action: null };
  }
  if (!date || !time) {
    return { assistantMessage: "When would you like to book? Please give me a date and time.", action: null };
  }

  // Find service
  const service = findService(context.services, service_name);
  if (service_name && !service) {
    const available = context.services.map(s => s.name).join(", ");
    return { assistantMessage: `I couldn't find "${service_name}". Our services are: ${available}`, action: null };
  }

  // Find staff
  const staffMember = findStaff(context.staff, staff_name);
  if (staff_name && !staffMember) {
    const available = context.staff.map(s => s.name).join(", ");
    return { assistantMessage: `I couldn't find staff member "${staff_name}". Our team: ${available}`, action: null };
  }

  // Parse date/time - treat as local business time (no Z suffix!)
  // We parse this way to keep time comparisons consistent with opening hours
  const dateParts = date.split('-');
  const timeParts = time.split(':');
  
  if (dateParts.length !== 3 || timeParts.length < 2) {
    return { assistantMessage: "I couldn't understand that date/time. Please use format like '2024-01-15' and '14:30'.", action: null };
  }
  
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const day = parseInt(dateParts[2]);
  const hour = parseInt(timeParts[0]);
  const minute = parseInt(timeParts[1]);
  
  // Create date as local time
  const startDate = new Date(year, month, day, hour, minute, 0);
  if (isNaN(startDate.getTime())) {
    return { assistantMessage: "I couldn't understand that date/time. Please use format like '2024-01-15' and '14:30'.", action: null };
  }

  const now = new Date();
  const currentTimeStr = now.toTimeString().slice(0, 5);
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  console.log(`[Aivia] Booking time check - Requested Date: ${date}, Time: ${time}, Current Date: ${currentDateStr}, Current Time: ${currentTimeStr}`);
  
  // CRITICAL: Check if the booking time has already passed
  // Compare dates first, then times if same date
  if (date < currentDateStr || (date === currentDateStr && time <= currentTimeStr)) {
    return { 
      assistantMessage: `That time has already passed. It's currently ${currentTimeStr} on ${currentDateStr}. Please choose a future time.`, 
      action: null 
    };
  }

  // POLICY: Check minimum booking notice
  const hoursUntilBooking = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilBooking < policies.minBookingNoticeHours) {
    return { 
      assistantMessage: `Sorry, I can't book that time. Our policy requires at least ${policies.minBookingNoticeHours} hours advance notice for bookings. The earliest I can book is ${formatTime(new Date(now.getTime() + policies.minBookingNoticeHours * 60 * 60 * 1000))} or later. Would you like a different time?`, 
      action: null 
    };
  }

  // POLICY: Check maximum days in advance
  const daysInAdvance = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysInAdvance > policies.maxDaysAdvance) {
    return { 
      assistantMessage: `Sorry, I can't book that far in advance. Our policy allows bookings up to ${policies.maxDaysAdvance} days ahead. The latest available date is ${formatDate(new Date(now.getTime() + policies.maxDaysAdvance * 24 * 60 * 60 * 1000))}. Would you like to pick an earlier date?`, 
      action: null 
    };
  }

  const duration = service?.duration_minutes || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);
  const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

  // Check opening hours - use string comparison for times
  const hoursCheck = isWithinOpeningHours(context.openingHours, date, time, endTimeStr);
  if (!hoursCheck.valid) {
    return { assistantMessage: `${hoursCheck.reason}. Would you like to pick a different time?`, action: null };
  }

  // Check staff time off FIRST
  if (staffMember) {
    const timeOffCheck = isStaffOnTimeOff(staffMember.id, startDate, context.staffTimeOff);
    if (timeOffCheck.onTimeOff) {
      // Find alternative available staff
      const availableStaff = getAvailableStaffAtTime(
        context.staff, startDate, duration, context.bookings, context.staffTimeOff
      );
      
      if (availableStaff.length === 0) {
        return {
          assistantMessage: `Sorry, ${staffMember.name} is off (${timeOffCheck.reason}) and no other staff are available at ${time} on that date. Would you like to try a different time?`,
          action: null,
        };
      }
      return {
        assistantMessage: `Sorry, ${staffMember.name} is off (${timeOffCheck.reason}). Available staff at that time: ${availableStaff.map(s => s.name).join(", ")}. Would you like to book with one of them?`,
        action: null,
      };
    }
  }

  // Check for booking conflicts
  if (staffMember) {
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id, customer_name, start_time")
      .eq("business_id", businessId)
      .eq("staff_id", staffMember.id)
      .neq("status", "cancelled")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflicts?.length > 0) {
      // Find alternative available staff
      const availableStaff = getAvailableStaffAtTime(
        context.staff, startDate, duration, context.bookings, context.staffTimeOff
      );
      
      if (availableStaff.length === 0) {
        const suggestedTime = new Date(startDate.getTime() + duration * 60000 + 30 * 60000);
        return {
          assistantMessage: `${staffMember.name} is already booked at that time and no other staff are available. How about ${formatTime(suggestedTime)} instead?`,
          action: null,
        };
      }
      return {
        assistantMessage: `${staffMember.name} is already booked at that time. Available staff: ${availableStaff.map(s => s.name).join(", ")}. Would you like to book with one of them?`,
        action: null,
      };
    }
  }

  // Create booking
  console.log("[Aivia] Creating booking:", { customer_name, date, time, service: service?.name, staff: staffMember?.name });

  const { data: booking, error } = await supabase
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

  if (error) {
    console.error("[Aivia] Booking error:", error);
    return { assistantMessage: `Sorry, I couldn't create the booking: ${error.message}`, action: null };
  }

  // Update/create customer record
  if (customer_phone && customer_phone !== "Not provided") {
    try {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", customer_phone)
        .maybeSingle();

      if (existing) {
        await supabase.from("customers").update({ name: customer_name }).eq("id", existing.id);
      } else {
        await supabase.from("customers").insert({ business_id: businessId, name: customer_name, phone: customer_phone });
      }
    } catch (e) {
      console.warn("[Aivia] Customer update failed:", e);
    }
  }

  // Send confirmation email
  try {
    console.log(`[Aivia] Sending confirmation email for booking ${booking.id}`);
    await supabase.functions.invoke("send-booking-email", {
      body: { businessId, bookingId: booking.id, type: "confirmation" }
    });
  } catch (emailError) {
    console.warn("[Aivia] Failed to send confirmation email:", emailError);
  }

  return {
    assistantMessage: `✅ Booked! ${customer_name} with ${staffMember?.name || "any available"} for ${service?.name || "appointment"} on ${formatDate(startDate)} at ${formatTime(startDate)}. Code: ${booking.booking_code}`,
    action: "create_booking",
    metadata: { bookingId: booking.id, bookingCode: booking.booking_code },
  };
}

async function handleCancelBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  formattedBookings: any[],
  rawBookings: any[],
  policies: any
): Promise<{ assistantMessage: string; action: string | null }> {
  const result = smartBookingLookup(formattedBookings, rawBookings, params);

  if (!result.found) {
    return { assistantMessage: result.message || "I couldn't find that booking.", action: null };
  }

  const booking = result.booking;
  const rawBooking = result.rawBooking;

  if (rawBooking.status === "cancelled") {
    return { assistantMessage: `This booking (${booking.code}) is already cancelled.`, action: null };
  }

  // POLICY: Check minimum cancellation notice
  const bookingStartTime = new Date(rawBooking.start_time);
  const now = new Date();
  const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilBooking < policies.minCancellationNoticeHours) {
    return { 
      assistantMessage: `Sorry, I can't cancel this booking. Our cancellation policy requires at least ${policies.minCancellationNoticeHours} hours notice, but this appointment is in ${Math.round(hoursUntilBooking * 10) / 10} hours.\n\nCancellation Policy: ${policies.cancellationPolicy}\n\nPlease call the business directly if this is an emergency.`, 
      action: null 
    };
  }

  // Cancel it
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by_user_id: userId })
    .eq("id", rawBooking.id);

  if (error) {
    return { assistantMessage: `Sorry, couldn't cancel: ${error.message}`, action: null };
  }

  // Send cancellation email
  try {
    console.log(`[Aivia] Sending cancellation email for booking ${rawBooking.id}`);
    await supabase.functions.invoke("send-booking-email", {
      body: { businessId, bookingId: rawBooking.id, type: "cancellation" }
    });
  } catch (emailError) {
    console.warn("[Aivia] Failed to send cancellation email:", emailError);
  }

  return {
    assistantMessage: `✅ Cancelled ${booking.customer}'s booking (${booking.code}) on ${booking.date} at ${booking.time}.`,
    action: "cancel_booking",
  };
}

async function handleRescheduleBooking(
  supabase: any,
  businessId: string,
  userId: string,
  params: any,
  context: { openingHours: any[]; bookings: any[]; rawBookings: any[] }
): Promise<{ assistantMessage: string; action: string | null }> {
  const { new_date, new_time } = params;

  const result = smartBookingLookup(context.bookings, context.rawBookings, params);

  if (!result.found) {
    return { assistantMessage: result.message || "I couldn't find that booking.", action: null };
  }

  const booking = result.booking;
  const rawBooking = result.rawBooking;

  if (!new_date || !new_time) {
    return {
      assistantMessage: `Found ${booking.customer}'s booking (${booking.code}) on ${booking.date} at ${booking.time}. What date and time would you like to move it to?`,
      action: null,
    };
  }

  if (rawBooking.status === "cancelled") {
    return { assistantMessage: "This booking is cancelled and can't be rescheduled.", action: null };
  }

  // Parse date/time as local business time
  const dateParts = new_date.split('-');
  const timeParts = new_time.split(':');
  
  if (dateParts.length !== 3 || timeParts.length < 2) {
    return { assistantMessage: "I couldn't understand that date/time.", action: null };
  }
  
  const startDate = new Date(
    parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]),
    parseInt(timeParts[0]), parseInt(timeParts[1]), 0
  );
  
  if (isNaN(startDate.getTime())) {
    return { assistantMessage: "I couldn't understand that date/time.", action: null };
  }

  const now = new Date();
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeStr = now.toTimeString().slice(0, 5);
  
  if (new_date < currentDateStr || (new_date === currentDateStr && new_time <= currentTimeStr)) {
    return { assistantMessage: "That time has already passed.", action: null };
  }

  const duration = booking.duration || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);
  const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

  const hoursCheck = isWithinOpeningHours(context.openingHours, new_date, new_time, endTimeStr);
  if (!hoursCheck.valid) {
    return { assistantMessage: `${hoursCheck.reason}. Pick a different time?`, action: null };
  }

  // Check conflicts
  if (booking.staffId) {
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", businessId)
      .eq("staff_id", booking.staffId)
      .neq("id", rawBooking.id)
      .neq("status", "cancelled")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflicts?.length > 0) {
      return { assistantMessage: "That slot is already taken. Please choose a different time.", action: null };
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({ start_time: startDate.toISOString(), end_time: endDate.toISOString(), last_modified_by_user_id: userId })
    .eq("id", rawBooking.id);

  if (error) {
    return { assistantMessage: `Sorry, couldn't reschedule: ${error.message}`, action: null };
  }

  return {
    assistantMessage: `✅ Rescheduled ${booking.customer}'s booking (${booking.code}) to ${formatDate(startDate)} at ${formatTime(startDate)}.`,
    action: "reschedule_booking",
  };
}

// Helper: Check if staff is on time off at a specific datetime
function isStaffOnTimeOff(staffId: string, datetime: Date, staffTimeOff: any[]): { onTimeOff: boolean; reason?: string } {
  const timeOffEntry = staffTimeOff.find((t) => {
    if (t.staff_id !== staffId) return false;
    const start = new Date(t.start_time);
    const end = new Date(t.end_time);
    return datetime >= start && datetime < end;
  });
  
  if (timeOffEntry) {
    return { onTimeOff: true, reason: timeOffEntry.reason };
  }
  return { onTimeOff: false };
}

// Helper: Get all staff who are available at a specific datetime (not on time off AND not booked)
function getAvailableStaffAtTime(
  staffList: any[],
  datetime: Date,
  durationMinutes: number,
  bookings: any[],
  staffTimeOff: any[]
): any[] {
  const slotStart = datetime;
  const slotEnd = new Date(datetime.getTime() + durationMinutes * 60000);
  const slotStartTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
  const slotEndTime = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${slotStart.getFullYear()}-${String(slotStart.getMonth() + 1).padStart(2, '0')}-${String(slotStart.getDate()).padStart(2, '0')}`;

  return staffList.filter((s) => {
    // Check if AI booking is enabled for this staff
    if (!s.ai_enabled) return false;

    // Check if staff is on time off
    const timeOffCheck = isStaffOnTimeOff(s.id, datetime, staffTimeOff);
    if (timeOffCheck.onTimeOff) {
      console.log(`[Aivia] Staff ${s.name} is on time off at ${datetime.toISOString()}: ${timeOffCheck.reason}`);
      return false;
    }

    // Check if staff has a booking at this time
    const hasConflict = bookings.some((b) => {
      if (b.staffId !== s.id) return false;
      if (b.date !== dateStr) return false;
      // Overlap check: booking starts before slot ends AND booking ends after slot starts
      return slotStartTime < b.endTime && slotEndTime > b.time;
    });

    if (hasConflict) {
      console.log(`[Aivia] Staff ${s.name} has a booking conflict at ${slotStartTime} on ${dateStr}`);
      return false;
    }

    return true;
  });
}

function handleCheckAvailability(
  params: any,
  context: { openingHours: any[]; bookings: any[]; staff: any[]; staffTimeOff: any[] }
): string {
  const { date, time, staff_name, duration_minutes = 60 } = params;

  if (!date) {
    return "Which date would you like me to check?";
  }

  // Validate date format
  const dateParts = date.split('-');
  if (dateParts.length !== 3) {
    return "I couldn't understand that date. Please use format YYYY-MM-DD.";
  }
  
  const targetDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
  if (isNaN(targetDate.getTime())) {
    return "I couldn't understand that date. Please use format YYYY-MM-DD.";
  }

  const hours = getOpeningHoursForDate(context.openingHours, date);
  const dayName = DAY_NAMES[targetDate.getDay()];

  if (!hours) {
    return `We're closed on ${dayName}.`;
  }

  // If a specific time is requested, check who's available at that exact time
  if (time) {
    const timeParts = time.split(':');
    if (timeParts.length >= 2) {
      const checkDatetime = new Date(
        parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]),
        parseInt(timeParts[0]), parseInt(timeParts[1]), 0
      );
      
      // Check if specific staff was requested
      if (staff_name) {
        const staffMember = findStaff(context.staff, staff_name);
        if (!staffMember) {
          const available = context.staff.map(s => s.name).join(", ");
          return `I couldn't find staff member "${staff_name}". Our team: ${available}`;
        }
        
        // Check if this specific staff is available
        const timeOffCheck = isStaffOnTimeOff(staffMember.id, checkDatetime, context.staffTimeOff);
        if (timeOffCheck.onTimeOff) {
          // Find who IS available
          const availableStaff = getAvailableStaffAtTime(
            context.staff, checkDatetime, duration_minutes, context.bookings, context.staffTimeOff
          );
          if (availableStaff.length === 0) {
            return `Sorry, ${staffMember.name} is off (${timeOffCheck.reason}) and no other staff are available at ${time} on ${formatDate(targetDate)}.`;
          }
          return `Sorry, ${staffMember.name} is off (${timeOffCheck.reason}) at that time. Available staff at ${time}: ${availableStaff.map(s => s.name).join(", ")}`;
        }
        
        // Check for booking conflicts
        const slotEnd = new Date(checkDatetime.getTime() + duration_minutes * 60000);
        const slotEndTime = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;
        
        const hasConflict = context.bookings.some((b) => {
          if (b.staffId !== staffMember.id) return false;
          if (b.date !== date) return false;
          return time < b.endTime && slotEndTime > b.time;
        });
        
        if (hasConflict) {
          const availableStaff = getAvailableStaffAtTime(
            context.staff, checkDatetime, duration_minutes, context.bookings, context.staffTimeOff
          );
          if (availableStaff.length === 0) {
            return `Sorry, ${staffMember.name} is already booked at ${time} and no other staff are available at that time.`;
          }
          return `Sorry, ${staffMember.name} is already booked at ${time}. Available staff: ${availableStaff.map(s => s.name).join(", ")}`;
        }
        
        return `✓ ${staffMember.name} is available at ${time} on ${formatDate(targetDate)}. Would you like to book?`;
      }
      
      // No specific staff - check who's available at this time
      const availableStaff = getAvailableStaffAtTime(
        context.staff, checkDatetime, duration_minutes, context.bookings, context.staffTimeOff
      );
      
      if (availableStaff.length === 0) {
        return `Sorry, no staff are available at ${time} on ${formatDate(targetDate)}. Would you like me to check a different time?`;
      }
      
      return `Available at ${time} on ${formatDate(targetDate)}: ${availableStaff.map(s => s.name).join(", ")}. Would you like to book?`;
    }
  }

  // No specific time - generate all available time slots
  const dateStr = date;
  const dayBookings = context.bookings.filter(b => b.date === dateStr);

  // Generate time slots (30-min increments)
  const slots: { time: string; availableStaff: string[] }[] = [];
  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  
  for (let h = openH; h < closeH || (h === closeH && 0 < closeM); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === openH && m < openM) continue;
      if (h === closeH && m >= closeM) continue;
      
      const slotTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const slotDatetime = new Date(
        parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]),
        h, m, 0
      );
      
      const availableStaff = getAvailableStaffAtTime(
        context.staff, slotDatetime, duration_minutes, context.bookings, context.staffTimeOff
      );
      
      if (availableStaff.length > 0) {
        // Filter by specific staff if requested
        if (staff_name) {
          const staffMember = findStaff(context.staff, staff_name);
          if (staffMember && availableStaff.some(s => s.id === staffMember.id)) {
            slots.push({ time: slotTime, availableStaff: [staffMember.name] });
          }
        } else {
          slots.push({ time: slotTime, availableStaff: availableStaff.map(s => s.name) });
        }
      }
    }
  }

  const dateFormatted = formatDate(targetDate);
  const staffInfo = staff_name ? ` with ${staff_name}` : "";

  if (slots.length === 0) {
    return `No available slots on ${dateFormatted}${staffInfo}. Would you like me to check another day?`;
  }

  const displaySlots = slots.slice(0, 10).map(s => s.time).join(", ");
  const more = slots.length > 10 ? ` (and ${slots.length - 10} more)` : "";

  return `📅 Available on ${dateFormatted}${staffInfo}:\n${displaySlots}${more}\n\nWould you like to book any of these times?`;
}

async function handleGetSchedule(supabase: any, businessId: string, params: any): Promise<string> {
  const { date, date_from, date_to, staff_name } = params;

  let fromDate = date || date_from || new Date().toISOString().split("T")[0];
  let toDate = date || date_to || fromDate;

  const toDateObj = new Date(toDate);
  toDateObj.setDate(toDateObj.getDate() + 1);

  let query = supabase
    .from("bookings")
    .select("*, service:service_id(name), staff:staff_id(name)")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("start_time", fromDate)
    .lt("start_time", toDateObj.toISOString().split("T")[0])
    .order("start_time");

  const { data: bookings, error } = await query;

  if (error) {
    return "Sorry, I couldn't fetch the schedule.";
  }

  if (!bookings?.length) {
    const dateStr = formatDate(new Date(fromDate));
    return `No bookings scheduled for ${dateStr}.`;
  }

  const dateStr = formatDate(new Date(fromDate));
  const list = bookings.map((b: any) => {
    const time = new Date(b.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `• ${time} - ${b.customer_name} with ${b.staff?.name || "TBD"} for ${b.service?.name || "appt"} (${b.booking_code})`;
  }).join("\n");

  return `📅 Schedule for ${dateStr}:\n${list}`;
}

function handleCustomerLookup(
  params: any,
  customers: any[],
  services: any[],
  staff: any[]
): string {
  const { customer_name, customer_phone } = params;

  if (!customer_name && !customer_phone) {
    return "Please give me a customer name or phone number to look up.";
  }

  let matches: any[] = [];

  if (customer_name) {
    const nameLower = customer_name.toLowerCase().trim();
    matches = customers.filter(c => c.name.toLowerCase().includes(nameLower));
  } else if (customer_phone) {
    const phoneClean = customer_phone.replace(/\D/g, "");
    matches = customers.filter(c => c.phone?.replace(/\D/g, "").includes(phoneClean));
  }

  if (matches.length === 0) {
    return `I couldn't find a customer matching "${customer_name || customer_phone}".`;
  }

  if (matches.length === 1) {
    const c = matches[0];
    const preferredStaff = c.preferredStaffId ? staff.find(s => s.id === c.preferredStaffId)?.name : null;
    
    let info = `Found ${c.name}`;
    if (c.phone) info += ` (${c.phone})`;
    info += `\n• Total visits: ${c.visits}`;
    if (preferredStaff) info += `\n• Preferred staff: ${preferredStaff}`;
    if (c.notes) info += `\n• Notes: ${c.notes}`;
    
    return info;
  }

  return `Found ${matches.length} customers:\n${matches.slice(0, 5).map(c => `• ${c.name}${c.phone ? ` (${c.phone})` : ""}`).join("\n")}`;
}

async function handleGetStats(supabase: any, businessId: string, params: any): Promise<string> {
  const { period = "week" } = params;

  const now = new Date();
  let fromDate: string;

  if (period === "today") {
    fromDate = now.toISOString().split("T")[0];
  } else if (period === "week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    fromDate = weekAgo.toISOString().split("T")[0];
  } else {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    fromDate = monthAgo.toISOString().split("T")[0];
  }

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, status, start_time")
    .eq("business_id", businessId)
    .gte("start_time", fromDate)
    .lte("start_time", now.toISOString());

  if (error) {
    return "Sorry, I couldn't fetch the stats.";
  }

  const total = bookings?.length || 0;
  const confirmed = bookings?.filter((b: any) => b.status === "confirmed").length || 0;
  const cancelled = bookings?.filter((b: any) => b.status === "cancelled").length || 0;

  const periodLabel = period === "today" ? "today" : period === "week" ? "this week" : "this month";

  return `📊 Stats for ${periodLabel}:\n• Total bookings: ${total}\n• Confirmed: ${confirmed}\n• Cancelled: ${cancelled}`;
}
