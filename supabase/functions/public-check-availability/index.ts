import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-CHECK-AVAILABILITY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { businessSlug, date, serviceId, staffId } = await req.json();
    logStep("Request received", { businessSlug, date, serviceId, staffId });

    if (!businessSlug || !date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: businessSlug and date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business by slug
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, online_booking_enabled, status")
      .eq("booking_slug", businessSlug)
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessSlug, error: businessError });
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business.online_booking_enabled || business.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Online booking is not available for this business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessId = business.id;
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Fetch all required data in parallel
    const [openingHoursResult, staffResult, bookingsResult, timeOffResult, serviceResult, settingsResult, staffServicesResult] = await Promise.all([
      supabase
        .from("opening_hours")
        .select("open_time, close_time, is_closed")
        .eq("business_id", businessId)
        .eq("day_of_week", dayOfWeek)
        .single(),
      supabase
        .from("staff")
        .select("id, name, working_hours, ai_enabled")
        .eq("business_id", businessId)
        .eq("ai_enabled", true),
      supabase
        .from("bookings")
        .select("start_time, end_time, staff_id")
        .eq("business_id", businessId)
        .in("status", ["confirmed", "completed"])
        .gte("start_time", `${date}T00:00:00`)
        .lt("start_time", `${date}T23:59:59`),
      supabase
        .from("staff_time_off")
        .select("staff_id, start_time, end_time")
        .eq("business_id", businessId)
        .eq("status", "approved")
        .lte("start_time", `${date}T23:59:59`)
        .gte("end_time", `${date}T00:00:00`),
      serviceId ? supabase.from("services").select("duration_minutes").eq("id", serviceId).single() : Promise.resolve({ data: null }),
      supabase.from("business_settings").select("min_booking_notice_hours").eq("business_id", businessId).single(),
      // Get staff-service assignments to filter staff who can provide the service
      serviceId ? supabase.from("staff_services").select("staff_id").eq("service_id", serviceId) : Promise.resolve({ data: null }),
    ]);

    const openingHours = openingHoursResult.data;
    const allStaff = staffResult.data || [];
    const existingBookings = bookingsResult.data || [];
    const timeOffs = timeOffResult.data || [];
    const service = serviceResult.data;
    const settings = settingsResult.data;
    const staffServices = staffServicesResult.data || [];

    // Filter staff to only those who can provide the requested service
    const staffIdsForService = staffServices.map((ss: any) => ss.staff_id);
    const staff = serviceId && staffIdsForService.length > 0 
      ? allStaff.filter(s => staffIdsForService.includes(s.id))
      : allStaff;

    logStep("Data fetched", { 
      hasOpeningHours: !!openingHours, 
      totalStaff: allStaff.length,
      staffForService: staff.length,
      bookingsCount: existingBookings.length,
      timeOffsCount: timeOffs.length,
      serviceId: serviceId || "none"
    });

    // Check if business is closed on this day
    if (!openingHours || openingHours.is_closed) {
      return new Response(
        JSON.stringify({ slots: [], message: "Business is closed on this day" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter staff if specific staff requested
    let availableStaff = staffId ? staff.filter(s => s.id === staffId) : staff;
    
    if (availableStaff.length === 0) {
      return new Response(
        JSON.stringify({ slots: [], message: "No staff available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse opening hours
    const openTime = openingHours.open_time;
    const closeTime = openingHours.close_time;
    
    if (!openTime || !closeTime) {
      return new Response(
        JSON.stringify({ slots: [], message: "Business hours not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate time slots (30-minute intervals)
    const slotDuration = service?.duration_minutes || 30;
    const minNoticeHours = settings?.min_booking_notice_hours || 2;
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

    const [openHour, openMin] = openTime.split(":").map(Number);
    const [closeHour, closeMin] = closeTime.split(":").map(Number);

    const slots: { time: string; available: boolean; availableStaff: string[] }[] = [];

    for (let hour = openHour; hour < closeHour || (hour === closeHour && 0 < closeMin); hour++) {
      for (let min = (hour === openHour ? openMin : 0); min < 60; min += 30) {
        if (hour === closeHour && min >= closeMin) break;
        
        const slotStart = new Date(requestedDate);
        slotStart.setHours(hour, min, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);
        
        // Check if slot end exceeds closing time
        const closeDateTime = new Date(requestedDate);
        closeDateTime.setHours(closeHour, closeMin, 0, 0);
        if (slotEnd > closeDateTime) continue;
        
        // Skip if slot is in the past (considering minimum notice)
        if (slotStart < minBookingTime) continue;

        // Check which staff are available for this slot
        const staffAvailableForSlot: string[] = [];
        
        for (const staffMember of availableStaff) {
          // Check if staff has time off
          const hasTimeOff = timeOffs.some(to => {
            if (to.staff_id !== staffMember.id) return false;
            const toStart = new Date(to.start_time);
            const toEnd = new Date(to.end_time);
            return slotStart < toEnd && slotEnd > toStart;
          });
          if (hasTimeOff) continue;

          // Check if staff has conflicting booking
          const hasConflict = existingBookings.some(b => {
            if (b.staff_id !== staffMember.id) return false;
            const bStart = new Date(b.start_time);
            const bEnd = new Date(b.end_time);
            return slotStart < bEnd && slotEnd > bStart;
          });
          if (hasConflict) continue;

          // Check staff working hours if defined
          if (staffMember.working_hours) {
            const workingHours = staffMember.working_hours as Record<string, any>;
            const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayOfWeek];
            const staffDayHours = workingHours[dayName];
            
            if (staffDayHours && !staffDayHours.isOff) {
              const [staffOpenHour, staffOpenMin] = (staffDayHours.start || "09:00").split(":").map(Number);
              const [staffCloseHour, staffCloseMin] = (staffDayHours.end || "17:00").split(":").map(Number);
              
              const staffStart = new Date(requestedDate);
              staffStart.setHours(staffOpenHour, staffOpenMin, 0, 0);
              
              const staffEnd = new Date(requestedDate);
              staffEnd.setHours(staffCloseHour, staffCloseMin, 0, 0);
              
              if (slotStart < staffStart || slotEnd > staffEnd) continue;
            } else if (staffDayHours?.isOff) {
              continue;
            }
          }

          staffAvailableForSlot.push(staffMember.id);
        }

        const timeString = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        slots.push({
          time: timeString,
          available: staffAvailableForSlot.length > 0,
          availableStaff: staffAvailableForSlot,
        });
      }
    }

    logStep("Slots generated", { totalSlots: slots.length, availableSlots: slots.filter(s => s.available).length });

    return new Response(
      JSON.stringify({ slots, staff: availableStaff.map(s => ({ id: s.id, name: s.name })) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { message: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
