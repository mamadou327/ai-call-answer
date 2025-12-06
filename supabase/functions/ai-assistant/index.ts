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

// Day name mappings (DB: Monday=0...Sunday=6, JS: Sunday=0...Saturday=6)
const DB_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function jsToDbDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function dbToJsDay(dbDay: number): number {
  return dbDay === 6 ? 0 : dbDay + 1;
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
        model: "google/gemini-2.5-flash",
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
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: upcomingBookings },
      { data: allBookings }, // Include cancelled bookings for lookup
      { data: recentBookings },
      { data: customers },
    ] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", validBusinessId).single(),
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
    ]);

    // =========== BUILD CONTEXT ===========
    const jsDayToday = now.getDay();
    const dbDayToday = jsToDbDay(jsDayToday);

    const formattedHours = openingHours?.map((h: any) => ({
      day: DB_DAY_NAMES[h.day_of_week],
      dbDay: h.day_of_week,
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    })) || [];

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
    const systemPrompt = `You are Aivia, an intelligent AI booking assistant for "${business?.business_name || "this business"}".
You help ${role === "owner" ? "the business owner" : "staff"} manage bookings efficiently and naturally.

═══════════════════════════════════════════════════════════════
CURRENT CONTEXT
═══════════════════════════════════════════════════════════════
NOW: ${now.toISOString()}
TODAY: ${DB_DAY_NAMES[dbDayToday]}, ${todayStr}
TOMORROW: ${tomorrow.toISOString().split("T")[0]}
DAY AFTER: ${dayAfterTomorrow.toISOString().split("T")[0]}

BUSINESS: ${business?.business_name}
ADDRESS: ${business?.address}
PHONE: ${business?.main_phone}

═══════════════════════════════════════════════════════════════
SERVICES
═══════════════════════════════════════════════════════════════
${services?.map((s: any) => `• ${s.name} | ${s.duration_minutes}min | £${s.price}`).join("\n") || "No services configured"}

═══════════════════════════════════════════════════════════════
STAFF
═══════════════════════════════════════════════════════════════
${staff?.map((s: any) => `• ${s.name} (${s.role})`).join("\n") || "No staff configured"}

═══════════════════════════════════════════════════════════════
OPENING HOURS
═══════════════════════════════════════════════════════════════
${formattedHours.map((h: any) => `• ${h.day}: ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

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
YOUR CAPABILITIES
═══════════════════════════════════════════════════════════════

1. CREATE BOOKING
   - Book appointments with validation
   - Prevent double-booking
   - Check opening hours

2. CANCEL BOOKING
   - Find by code, name, phone, date
   - Always confirm before cancelling

3. RESCHEDULE BOOKING
   - Move to new date/time
   - Validate new slot

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
CRITICAL RULES
═══════════════════════════════════════════════════════════════

1. ALWAYS respond with valid JSON - never plain text!

2. For cancel/reschedule with a NAME:
   → IMMEDIATELY try the action with that name
   → The backend will search and return results
   → DO NOT ask for phone first!

3. ALWAYS confirm before destructive actions

4. Be helpful and natural - suggest alternatives if something won't work

5. Reference bookings by CODE (like PRE-2647), not internal IDs

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
EXAMPLES
═══════════════════════════════════════════════════════════════

User: "Cancel James booking"
→ {"action":"cancel_booking","params":{"customer_name":"James"},"message":"Looking for James's booking..."}

User: "What times are free tomorrow?"
→ {"action":"check_availability","params":{"date":"${tomorrow.toISOString().split("T")[0]}"},"message":"Let me check availability for tomorrow..."}

User: "Book Sarah's usual with Ahmed tomorrow at 2pm"
→ {"action":"customer_lookup","params":{"customer_name":"Sarah"},"message":"Looking up Sarah's preferences..."}
(Then create_booking with her usual service)

User: "How many bookings do we have this week?"
→ {"action":"get_stats","params":{"period":"week"},"message":"Checking this week's bookings..."}

User: "Cancel booking 2647"
→ {"action":"cancel_booking","params":{"booking_code_suffix":"2647"},"message":"Looking for booking ending in 2647..."}

REMEMBER: ALWAYS respond with JSON. Never plain text.`;

    // =========== CALL AI ===========
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
      });
      return jsonResponse(result);
    }

    // CANCEL BOOKING - use allBookings to find cancelled ones too
    if (action === "cancel_booking") {
      const result = await handleCancelBooking(supabase, validBusinessId, verifiedUserId, params, formattedAllBookings, allBookings || []);
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

function getOpeningHoursForDate(openingHours: any[], date: Date): { open: string; close: string } | null {
  const jsDay = date.getDay();
  const dbDay = jsToDbDay(jsDay);
  const hours = openingHours.find(h => h.day_of_week === dbDay);
  if (!hours || hours.is_closed) return null;
  return { open: hours.open_time, close: hours.close_time };
}

function isWithinOpeningHours(openingHours: any[], startDate: Date, endDate: Date): { valid: boolean; reason?: string } {
  const hours = getOpeningHoursForDate(openingHours, startDate);
  const dayName = DB_DAY_NAMES[jsToDbDay(startDate.getDay())];

  if (!hours) {
    return { valid: false, reason: `We're closed on ${dayName}` };
  }

  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);

  if (startTime < hours.open) {
    return { valid: false, reason: `We open at ${hours.open} on ${dayName}` };
  }
  if (endTime > hours.close) {
    return { valid: false, reason: `We close at ${hours.close} on ${dayName}, but this booking would end at ${endTime}` };
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
  context: { services: any[]; staff: any[]; openingHours: any[]; bookings: any[] }
): Promise<{ assistantMessage: string; action: string | null; metadata?: any }> {
  const { customer_name, customer_phone, service_name, staff_name, date, time, notes } = params;

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

  // Parse date/time
  const startDate = new Date(`${date}T${time}:00`);
  if (isNaN(startDate.getTime())) {
    return { assistantMessage: "I couldn't understand that date/time. Please use format like '2024-01-15' and '14:30'.", action: null };
  }

  if (startDate < new Date()) {
    return { assistantMessage: "That time has already passed. Please choose a future time.", action: null };
  }

  const duration = service?.duration_minutes || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  // Check opening hours
  const hoursCheck = isWithinOpeningHours(context.openingHours, startDate, endDate);
  if (!hoursCheck.valid) {
    return { assistantMessage: `${hoursCheck.reason}. Would you like to pick a different time?`, action: null };
  }

  // Check for conflicts
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
      // Suggest next available slot
      const suggestedTime = new Date(startDate.getTime() + duration * 60000 + 30 * 60000);
      return {
        assistantMessage: `${staffMember.name} already has a booking at that time. How about ${formatTime(suggestedTime)} instead?`,
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
  rawBookings: any[]
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

  // Cancel it
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by_user_id: userId })
    .eq("id", rawBooking.id);

  if (error) {
    return { assistantMessage: `Sorry, couldn't cancel: ${error.message}`, action: null };
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

  const startDate = new Date(`${new_date}T${new_time}:00`);
  if (isNaN(startDate.getTime())) {
    return { assistantMessage: "I couldn't understand that date/time.", action: null };
  }

  if (startDate < new Date()) {
    return { assistantMessage: "That time has already passed.", action: null };
  }

  const duration = booking.duration || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  const hoursCheck = isWithinOpeningHours(context.openingHours, startDate, endDate);
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

function handleCheckAvailability(
  params: any,
  context: { openingHours: any[]; bookings: any[]; staff: any[] }
): string {
  const { date, staff_name, duration_minutes = 60 } = params;

  if (!date) {
    return "Which date would you like me to check?";
  }

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    return "I couldn't understand that date. Please use format YYYY-MM-DD.";
  }

  const hours = getOpeningHoursForDate(context.openingHours, targetDate);
  const dayName = DB_DAY_NAMES[jsToDbDay(targetDate.getDay())];

  if (!hours) {
    return `We're closed on ${dayName}.`;
  }

  // Find bookings for this date
  const dateStr = date;
  const dayBookings = context.bookings.filter(b => b.date === dateStr);

  // Filter by staff if specified
  let staffMember = staff_name ? findStaff(context.staff, staff_name) : null;
  const relevantBookings = staffMember
    ? dayBookings.filter(b => b.staffId === staffMember.id)
    : dayBookings;

  // Generate time slots (30-min increments)
  const slots: string[] = [];
  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  
  for (let h = openH; h < closeH || (h === closeH && 0 < closeM); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === openH && m < openM) continue;
      if (h === closeH && m >= closeM) continue;
      
      const slotTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const slotEnd = new Date(`${dateStr}T${slotTime}:00`);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration_minutes);
      const slotEndTime = slotEnd.toTimeString().slice(0, 5);

      if (slotEndTime > hours.close) continue;

      // Check if slot is free
      const conflict = relevantBookings.some(b => {
        return slotTime < b.endTime && slotEndTime > b.time;
      });

      if (!conflict) {
        slots.push(slotTime);
      }
    }
  }

  const dateFormatted = formatDate(targetDate);
  const staffInfo = staffMember ? ` with ${staffMember.name}` : "";

  if (slots.length === 0) {
    return `No available slots on ${dateFormatted}${staffInfo}. Would you like me to check another day?`;
  }

  const displaySlots = slots.slice(0, 10).join(", ");
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
