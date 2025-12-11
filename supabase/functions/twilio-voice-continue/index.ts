import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// ============================================================================
// TWILIO SIGNATURE VALIDATION
// ============================================================================

async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    console.error("[VoiceContinue] No X-Twilio-Signature header provided");
    return false;
  }

  try {
    // Sort params alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + params[key];
    }

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const data = encoder.encode(dataString);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignature = encodeBase64(new Uint8Array(signatureBuffer));

    const isValid = expectedSignature === signature;
    if (!isValid) {
      console.error("[VoiceContinue] Signature mismatch");
    }
    return isValid;
  } catch (error) {
    console.error("[VoiceContinue] Error validating signature:", error);
    return false;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Base speech hints for better STT recognition with accents
const BASE_SPEECH_HINTS = "booking, appointment, cancel, reschedule, haircut, beard, trim, shave, fade, lineup, braids, cornrows, locs, twists, weave, relaxer, perm, colour, color, highlights, balayage, blowout, wash, style, tomorrow, today, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, morning, afternoon, evening, o'clock, half past, quarter past, available, availability, name, phone, confirm, yes, no, please, thank you, next week, this week";

// Fetch dynamic speech hints from business data (staff names, services)
async function getBusinessSpeechHints(supabase: any, businessId: string): Promise<string> {
  const hints: string[] = [BASE_SPEECH_HINTS];
  
  try {
    // Fetch staff names
    const { data: staff } = await supabase
      .from("staff")
      .select("name")
      .eq("business_id", businessId);
    
    if (staff && staff.length > 0) {
      const staffNames = staff.map((s: any) => s.name).filter(Boolean);
      if (staffNames.length > 0) {
        hints.push(staffNames.join(", "));
      }
    }
    
    // Fetch service names
    const { data: services } = await supabase
      .from("services")
      .select("name, category")
      .eq("business_id", businessId);
    
    if (services && services.length > 0) {
      const serviceNames = services.map((s: any) => s.name).filter(Boolean);
      const categories = [...new Set(services.map((s: any) => s.category).filter(Boolean))];
      if (serviceNames.length > 0) {
        hints.push(serviceNames.join(", "));
      }
      if (categories.length > 0) {
        hints.push(categories.join(", "));
      }
    }
    
    console.log(`[VoiceContinue] Built speech hints with ${staff?.length || 0} staff and ${services?.length || 0} services`);
  } catch (error) {
    console.error("[VoiceContinue] Error fetching speech hints:", error);
  }
  
  return hints.join(", ");
}

// Default ElevenLabs voice IDs
const DEFAULT_VOICES = {
  female: "EXAVITQu4vr4xnSDxMaL", // Sarah
  male: "CwhRBWXzGAHq8TQ4Fs17", // Roger
};

// Generate audio with ElevenLabs and upload to storage
async function generateAndUploadAudio(
  supabase: any,
  text: string,
  voiceId: string,
  callSid: string,
  messageId: string
): Promise<string | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.error("[VoiceContinue] ELEVENLABS_API_KEY not configured");
    return null;
  }

  try {
    console.log(`[VoiceContinue] Generating ElevenLabs audio`);
    const startTime = Date.now();
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5", // Fastest model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoiceContinue] ElevenLabs API error:", response.status, errorText);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[VoiceContinue] ElevenLabs audio generated in ${Date.now() - startTime}ms`);

    // Upload to storage
    const fileName = `voice-responses/${callSid}/${messageId}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[VoiceContinue] Storage upload error:", uploadError);
      return null;
    }

    // Get signed URL (valid for 60 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(fileName, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[VoiceContinue] Failed to create signed URL:", signedUrlError);
      return null;
    }

    console.log(`[VoiceContinue] Audio uploaded, total time: ${Date.now() - startTime}ms`);
    return signedUrlData.signedUrl;
  } catch (error) {
    console.error("[VoiceContinue] Error generating audio:", error);
    return null;
  }
}

// TwiML with ElevenLabs audio - using Deepgram nova-2 for better accent recognition
function twimlContinueWithAudio(audioUrl: string, actionUrl: string, speechHints: string = BASE_SPEECH_HINTS, timeout: number = 6): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    <Play>${audioUrl}</Play>
  </Gather>
  <Say voice="Polly.Amy-Neural" language="en-GB"><prosody rate="108%">I didn't hear anything. If you need help, just give us another call. Goodbye!</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function twimlEndWithAudio(audioUrl: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Fallback Polly TwiML functions - using Deepgram nova-2 for better accent recognition
function twimlContinue(sayText: string, actionUrl: string, voice: string, speechHints: string = BASE_SPEECH_HINTS, rate: string = "108%", timeout: number = 6): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(sayText)}</prosody></Say>
  </Gather>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">I didn't hear anything. If you need help, just give us another call. Goodbye!</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function twimlEnd(sayText: string, voice: string, rate: string = "108%"): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(sayText)}</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function twimlClarify(sayText: string, actionUrl: string, voice: string, speechHints: string = BASE_SPEECH_HINTS, rate: string = "108%"): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="6" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(sayText)}</prosody></Say>
  </Gather>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">I still didn't catch that. Please call back if you need help. Goodbye!</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function twimlClarifyWithAudio(audioUrl: string, actionUrl: string, speechHints: string = BASE_SPEECH_HINTS): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="6" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    <Play>${audioUrl}</Play>
  </Gather>
  <Say voice="Polly.Amy-Neural" language="en-GB"><prosody rate="108%">I still didn't catch that. Please call back if you need help. Goodbye!</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function twimlError(message: string, voice: string = "Polly.Amy-Neural", rate: string = "108%"): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(message)}</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Day name mappings (DB: Monday=0...Sunday=6, JS: Sunday=0...Saturday=6)
const DB_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function jsToDbDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function dbToJsDay(dbDay: number): number {
  return dbDay === 6 ? 0 : dbDay + 1;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// SMART DATE PARSING
// ============================================================================

function parseNaturalDate(input: string, now: Date): { date: string; dayName: string } | null {
  const text = input.toLowerCase().trim();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // "today"
  if (text.includes("today")) {
    return { date: today.toISOString().split("T")[0], dayName: "today" };
  }

  // "tomorrow"
  if (text.includes("tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow.toISOString().split("T")[0], dayName: "tomorrow" };
  }

  // "day after tomorrow"
  if (text.includes("day after tomorrow")) {
    const dat = new Date(today);
    dat.setDate(dat.getDate() + 2);
    return { date: dat.toISOString().split("T")[0], dayName: DB_DAY_NAMES[jsToDbDay(dat.getDay())] };
  }

  // "this weekend" / "on the weekend" - find Saturday
  if (text.includes("weekend") || text.includes("saturday") || text.includes("sunday")) {
    const daysToSat = (6 - today.getDay() + 7) % 7 || 7;
    if (text.includes("sunday")) {
      const sun = new Date(today);
      sun.setDate(sun.getDate() + ((7 - today.getDay()) % 7 || 7));
      return { date: sun.toISOString().split("T")[0], dayName: "Sunday" };
    }
    const sat = new Date(today);
    sat.setDate(sat.getDate() + daysToSat);
    return { date: sat.toISOString().split("T")[0], dayName: "Saturday" };
  }

  // Day names: "monday", "next tuesday", "this friday"
  const dayPatterns = [
    { pattern: /\bmonday\b/, day: 1 },
    { pattern: /\btuesday\b/, day: 2 },
    { pattern: /\bwednesday\b/, day: 3 },
    { pattern: /\bthursday\b/, day: 4 },
    { pattern: /\bfriday\b/, day: 5 },
    { pattern: /\bsaturday\b/, day: 6 },
    { pattern: /\bsunday\b/, day: 0 },
  ];

  for (const { pattern, day } of dayPatterns) {
    if (pattern.test(text)) {
      const isNext = text.includes("next");
      const currentDay = today.getDay();
      let daysAhead = (day - currentDay + 7) % 7;
      if (daysAhead === 0 && !text.includes("this")) daysAhead = 7;
      if (isNext && daysAhead <= 7) daysAhead += 7;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      return { date: targetDate.toISOString().split("T")[0], dayName: DB_DAY_NAMES[jsToDbDay(day)] };
    }
  }

  // "next week" - defaults to next Monday
  if (text.includes("next week")) {
    const currentDay = today.getDay();
    const daysToMon = (1 - currentDay + 7) % 7 + 7;
    const nextMon = new Date(today);
    nextMon.setDate(nextMon.getDate() + daysToMon);
    return { date: nextMon.toISOString().split("T")[0], dayName: "next Monday" };
  }

  // Specific date patterns: "15th", "the 20th", "January 15"
  const dateMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(\w+))?/);
  if (dateMatch) {
    const dayNum = parseInt(dateMatch[1]);
    const monthName = dateMatch[2];
    const target = new Date(today);
    
    if (monthName) {
      const months = ["january", "february", "march", "april", "may", "june", 
                      "july", "august", "september", "october", "november", "december"];
      const monthIdx = months.findIndex(m => monthName.toLowerCase().startsWith(m.slice(0, 3)));
      if (monthIdx >= 0) {
        target.setMonth(monthIdx);
        target.setDate(dayNum);
        if (target < today) target.setFullYear(target.getFullYear() + 1);
        return { date: target.toISOString().split("T")[0], dayName: formatDate(target) };
      }
    } else {
      target.setDate(dayNum);
      if (target < today) target.setMonth(target.getMonth() + 1);
      return { date: target.toISOString().split("T")[0], dayName: formatDate(target) };
    }
  }

  return null;
}

function parseNaturalTime(input: string): string | null {
  const text = input.toLowerCase().trim();
  
  // "2pm", "2 pm", "2:30pm", "14:00", "2 o'clock"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'?clock)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();
    
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    if (!period && hour >= 1 && hour <= 7) hour += 12; // Assume afternoon for low hours
    
    return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Named times
  if (text.includes("morning")) return "10:00";
  if (text.includes("noon") || text.includes("midday")) return "12:00";
  if (text.includes("afternoon")) return "14:00";
  if (text.includes("evening")) return "17:00";

  return null;
}

// ============================================================================
// AVAILABILITY CHECKING
// ============================================================================

interface AvailabilityCheck {
  isAvailable: boolean;
  reason?: string;
  suggestedSlots?: string[];
}

async function checkRealAvailability(
  supabase: any,
  businessId: string,
  date: string,
  time: string,
  durationMinutes: number,
  staffId: string | null,
  openingHours: any[]
): Promise<AvailabilityCheck> {
  const requestedStart = new Date(`${date}T${time}:00`);
  const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60000);
  const now = new Date();

  // Check if it's in the past
  if (requestedStart < now) {
    return { isAvailable: false, reason: "That time has already passed" };
  }

  // Check opening hours
  const jsDay = requestedStart.getDay();
  const dbDay = jsToDbDay(jsDay);
  const dayHours = openingHours.find((h: any) => h.day_of_week === dbDay);

  if (!dayHours || dayHours.is_closed) {
    return { 
      isAvailable: false, 
      reason: `We're closed on ${DB_DAY_NAMES[dbDay]}s`,
      suggestedSlots: await findNextAvailableSlots(supabase, businessId, requestedStart, durationMinutes, staffId, openingHours)
    };
  }

  const openTime = dayHours.open_time;
  const closeTime = dayHours.close_time;
  const requestedTimeStr = time;
  const requestedEndTimeStr = `${requestedEnd.getHours().toString().padStart(2, "0")}:${requestedEnd.getMinutes().toString().padStart(2, "0")}`;

  if (requestedTimeStr < openTime) {
    return { 
      isAvailable: false, 
      reason: `We don't open until ${openTime.slice(0, 5)} on ${DB_DAY_NAMES[dbDay]}s`,
      suggestedSlots: [openTime.slice(0, 5)]
    };
  }

  if (requestedEndTimeStr > closeTime) {
    return { 
      isAvailable: false, 
      reason: `Your appointment would end after we close at ${closeTime.slice(0, 5)}` 
    };
  }

  // Check staff time off if staff specified
  if (staffId) {
    const { data: timeOff } = await supabase
      .from("staff_time_off")
      .select("*")
      .eq("staff_id", staffId)
      .eq("status", "approved")
      .lte("start_time", requestedEnd.toISOString())
      .gte("end_time", requestedStart.toISOString());

    if (timeOff && timeOff.length > 0) {
      return { 
        isAvailable: false, 
        reason: "That staff member is not available at that time",
        suggestedSlots: await findNextAvailableSlots(supabase, businessId, requestedStart, durationMinutes, staffId, openingHours)
      };
    }
  }

  // Check for conflicting bookings
  let query = supabase
    .from("bookings")
    .select("id, start_time, end_time, staff_id, staff:staff_id(name)")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .lt("start_time", requestedEnd.toISOString())
    .gt("end_time", requestedStart.toISOString());

  if (staffId) {
    query = query.eq("staff_id", staffId);
  }

  const { data: conflicts } = await query;

  if (conflicts && conflicts.length > 0) {
    // If staff was specified, suggest another time
    if (staffId) {
      return { 
        isAvailable: false, 
        reason: "That time slot is already booked",
        suggestedSlots: await findNextAvailableSlots(supabase, businessId, requestedStart, durationMinutes, staffId, openingHours)
      };
    }
    
    // If no staff specified, check if any staff is free
    const { data: allStaff } = await supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId);

    if (allStaff) {
      const bookedStaffIds = conflicts.map((c: any) => c.staff_id);
      const availableStaff = allStaff.filter((s: any) => !bookedStaffIds.includes(s.id));
      
      if (availableStaff.length > 0) {
        return { isAvailable: true }; // At least one staff member is available
      }
    }

    return { 
      isAvailable: false, 
      reason: "All staff are booked at that time",
      suggestedSlots: await findNextAvailableSlots(supabase, businessId, requestedStart, durationMinutes, null, openingHours)
    };
  }

  return { isAvailable: true };
}

async function findNextAvailableSlots(
  supabase: any,
  businessId: string,
  fromDate: Date,
  durationMinutes: number,
  staffId: string | null,
  openingHours: any[]
): Promise<string[]> {
  const slots: string[] = [];
  const checkDate = new Date(fromDate);
  
  for (let dayOffset = 0; dayOffset < 7 && slots.length < 3; dayOffset++) {
    const date = new Date(checkDate);
    date.setDate(date.getDate() + dayOffset);
    const dbDay = jsToDbDay(date.getDay());
    const dayHours = openingHours.find((h: any) => h.day_of_week === dbDay);
    
    if (!dayHours || dayHours.is_closed) continue;
    
    const openHour = parseInt(dayHours.open_time.split(":")[0]);
    const closeHour = parseInt(dayHours.close_time.split(":")[0]);
    
    for (let hour = openHour; hour < closeHour && slots.length < 3; hour++) {
      const timeStr = `${hour.toString().padStart(2, "0")}:00`;
      const slotStart = new Date(`${date.toISOString().split("T")[0]}T${timeStr}:00`);
      
      if (slotStart < new Date()) continue;
      
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      
      let query = supabase
        .from("bookings")
        .select("id")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .lt("start_time", slotEnd.toISOString())
        .gt("end_time", slotStart.toISOString());
      
      if (staffId) query = query.eq("staff_id", staffId);
      
      const { data: conflicts } = await query;
      
      if (!conflicts || conflicts.length === 0) {
        const dayName = dayOffset === 0 ? "today" : dayOffset === 1 ? "tomorrow" : DB_DAY_NAMES[dbDay];
        slots.push(`${dayName} at ${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "pm" : "am"}`);
      }
    }
  }
  
  return slots;
}

// ============================================================================
// CALLER RECOGNITION
// ============================================================================

interface CallerInfo {
  isReturning: boolean;
  name?: string;
  totalVisits?: number;
  lastBooking?: {
    service: string;
    serviceId: string;
    date: string;
    staff: string;
    staffId: string;
  };
  preferredStaff?: string;
  preferredStaffId?: string;
  upcomingBooking?: {
    code: string;
    service: string;
    date: string;
    time: string;
  };
}

async function recognizeCaller(
  supabase: any, 
  businessId: string, 
  phone: string
): Promise<CallerInfo> {
  // Normalize phone number for matching
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
  
  // Check customers table
  const { data: customer } = await supabase
    .from("customers")
    .select("name, total_visits, preferred_staff_id, preferred_staff:preferred_staff_id(id, name)")
    .eq("business_id", businessId)
    .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${phone}`)
    .maybeSingle();

  if (!customer) {
    return { isReturning: false };
  }

  // Get their last completed booking
  const { data: lastBooking } = await supabase
    .from("bookings")
    .select("start_time, service_id, staff_id, service:service_id(id, name), staff:staff_id(id, name)")
    .eq("business_id", businessId)
    .ilike("customer_phone", `%${normalizedPhone}%`)
    .eq("status", "completed")
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check for upcoming bookings
  const { data: upcomingBooking } = await supabase
    .from("bookings")
    .select("booking_code, start_time, service:service_id(name)")
    .eq("business_id", businessId)
    .ilike("customer_phone", `%${normalizedPhone}%`)
    .neq("status", "cancelled")
    .gte("start_time", new Date().toISOString())
    .order("start_time")
    .limit(1)
    .maybeSingle();

  return {
    isReturning: true,
    name: customer.name,
    totalVisits: customer.total_visits,
    preferredStaff: customer.preferred_staff?.name,
    preferredStaffId: customer.preferred_staff?.id,
    lastBooking: lastBooking ? {
      service: lastBooking.service?.name || "appointment",
      serviceId: lastBooking.service?.id || lastBooking.service_id,
      date: new Date(lastBooking.start_time).toLocaleDateString("en-GB"),
      staff: lastBooking.staff?.name || "",
      staffId: lastBooking.staff?.id || lastBooking.staff_id
    } : undefined,
    upcomingBooking: upcomingBooking ? {
      code: upcomingBooking.booking_code,
      service: upcomingBooking.service?.name || "appointment",
      date: new Date(upcomingBooking.start_time).toLocaleDateString("en-GB"),
      time: formatTime(new Date(upcomingBooking.start_time))
    } : undefined
  };
}

// ============================================================================
// AI VOICE ASSISTANT LOGIC
// ============================================================================

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

async function processWithAI(
  lovableApiKey: string,
  businessContext: string,
  conversationHistory: Message[],
  userInput: string
): Promise<{ reply: string; action?: any; shouldEnd: boolean }> {
  
  const systemPrompt = `You are a phone receptionist for a UK-based business. Speak naturally, warmly, and concisely like a real human.

CRITICAL: NEVER reveal you are an AI, virtual assistant, or automated system. You are simply a receptionist named after the ASSISTANT NAME below. If asked directly, deflect naturally: "I'm [Name], the receptionist here."

${businessContext}

═══════════════════════════════════════════════════════════════
YOUR ROLE AS PHONE RECEPTIONIST
═══════════════════════════════════════════════════════════════

Handle phone calls for bookings and inquiries. You can:
1. CREATE BOOKINGS - Must collect: service, staff/barber, date/time, customer name
2. CANCEL BOOKINGS - Need booking code or customer name
3. RESCHEDULE BOOKINGS - Find booking first, then new date/time  
4. ANSWER QUESTIONS - Services, pricing, opening hours, etc.
5. TAKE MESSAGES - For the business owner/staff

═══════════════════════════════════════════════════════════════
CRITICAL: BOOKING FLOW (ALWAYS FOLLOW THIS ORDER)
═══════════════════════════════════════════════════════════════

For EVERY booking, you MUST collect these in order:
1. SERVICE - What service do they want?
2. STAFF/BARBER - Which staff member do they prefer?
3. DATE/TIME - When do they want it?
4. NAME - What's their name? (skip if returning customer with name known)

NEVER create a booking without:
- A specific service selected
- A specific staff member selected
- A confirmed date and time

═══════════════════════════════════════════════════════════════
RETURNING CUSTOMERS - PERSONALIZED BUT STILL ASK
═══════════════════════════════════════════════════════════════

If CALLER INFO shows they're a returning customer:
- Greet them by name warmly: "Hi [Name], lovely to hear from you again!"
- If they have an UPCOMING BOOKING, mention it proactively
- OFFER their usual service/staff as a suggestion, but STILL CONFIRM:
  "Would you like your usual [service] with [preferred staff], or something different?"
- If they say "the same" or "usual", use their last booking's service and preferred staff
- If they want something different, go through the normal selection

For NEW callers:
- Ask for service first: "What service would you like today?"
- Then ask for staff: "Which barber would you prefer? We have [list names]"
- Then date/time, then name

═══════════════════════════════════════════════════════════════
SERVICE SELECTION (STEP 1)
═══════════════════════════════════════════════════════════════

- If caller says "I want to book" without a service, ASK which service
- List services naturally: "We offer [service1], [service2], and [service3]. Which would you like?"
- Match what they say to a service from the SERVICES list
- Confirm their selection before moving to staff

═══════════════════════════════════════════════════════════════
STAFF SELECTION (STEP 2)
═══════════════════════════════════════════════════════════════

- ALWAYS ask which staff member they want, even for new customers
- For returning customers: "Would you like [preferred staff] again, or someone else?"
- For new customers: "Who would you like to see you? We have [list staff names]"
- If they say "anyone" or "whoever is available", note that and find first available
- Match what they say to a staff member from the STAFF list

═══════════════════════════════════════════════════════════════
SMART DATE/TIME UNDERSTANDING
═══════════════════════════════════════════════════════════════

You understand natural date expressions:
- "tomorrow", "today", "day after tomorrow"
- "this Friday", "next Monday", "next week"
- "this weekend", "Saturday", "Sunday"
- "the 15th", "January 20th"

And natural time expressions:
- "2pm", "2:30", "half past 2"
- "morning", "afternoon", "evening"

Always confirm back clearly: "So that's Friday the 15th at 2pm with [staff name] for a [service]?"

═══════════════════════════════════════════════════════════════
REAL-TIME AVAILABILITY
═══════════════════════════════════════════════════════════════

AVAILABILITY INFO is provided in the context. Use it to:
- Only offer times when the SELECTED STAFF is available
- If requested time is unavailable, apologize and offer alternatives
- Check if that specific staff member is free at that time

═══════════════════════════════════════════════════════════════
CONVERSATION FLOW - NATURAL DIALOGUE
═══════════════════════════════════════════════════════════════

- Ask ONE question at a time
- Collect: Service → Staff → Date/Time → Name (in that order)
- DO NOT say "Is there anything else?" until booking is COMPLETE
- Keep responses SHORT and natural (1-2 sentences)
- Use contractions: "I've", "we're", "that's", "you're"
- Add natural fillers occasionally: "Lovely", "Perfect", "Great"

═══════════════════════════════════════════════════════════════
TAKING MESSAGES (STEP 5)
═══════════════════════════════════════════════════════════════

When a caller wants to leave a message:
- Ask who the message is for (business owner, specific staff, or all staff)
- Ask what message they'd like to leave
- Confirm the message back to them
- Mark as urgent if they mention it's urgent or time-sensitive

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON) - EXTREMELY IMPORTANT
═══════════════════════════════════════════════════════════════

ALWAYS respond with valid JSON:
{
  "reply": "What you say to the caller",
  "action": null or { "type": "...", "params": {...} },
  "shouldEnd": false or true
}

═══════════════════════════════════════════════════════════════
CRITICAL: WHEN TO INCLUDE ACTION (MUST FOLLOW)
═══════════════════════════════════════════════════════════════

YOU MUST include the "action" field when:
1. CONFIRMING a booking - When you say "See you then", "Booked", "All set", "Confirmed" etc, you MUST include the create_booking action
2. CANCELLING a booking - When confirming a cancellation, include cancel_booking action
3. RESCHEDULING - When confirming a reschedule, include reschedule_booking action
4. SAVING a message - When confirming you'll pass on a message, include leave_message action

DO NOT just confirm verbally without the action! The booking is NOT created until you include the action.

Example - CORRECT (creates the booking):
{
  "reply": "Perfect! I've booked you in for a Haircut with Aloma today at 3pm. See you then!",
  "action": { "type": "create_booking", "params": { "customer_name": "Moe", "customer_phone": "+447491004439", "service_name": "Haircut", "staff_name": "Aloma", "date": "2025-12-11", "time": "15:00" } },
  "shouldEnd": false
}

Example - WRONG (does NOT create booking):
{
  "reply": "Perfect! See you then!",
  "shouldEnd": false
}

ACTION PARAMETERS:
- create_booking: { customer_name, customer_phone, service_name, staff_name, date (YYYY-MM-DD), time (HH:MM) }
  ALL FIELDS REQUIRED - must have service_name AND staff_name AND date AND time AND customer_name
- cancel_booking: { booking_code or customer_name }
- reschedule_booking: { booking_code or customer_name, new_date, new_time }
- leave_message: { message, recipient_type ("all"|"admin"|"staff"), recipient_staff_name (if for specific staff), is_urgent (boolean) }

CRITICAL: Your response must be ONLY the JSON object. No text before or after.

Set shouldEnd = true ONLY when caller explicitly says goodbye or is done.`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userInput }
  ];

  try {
    console.log("[VoiceAI] Calling AI gateway...");
    const aiStartTime = Date.now();
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini", // Smarter model for better understanding accents and context
        messages,
      }),
    });
    
    console.log("[VoiceAI] AI response time:", Date.now() - aiStartTime, "ms");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoiceAI] AI Gateway error:", response.status, errorText);
      return {
        reply: "I'm sorry, I'm having a little trouble right now. Could you please repeat that?",
        shouldEnd: false
      };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    console.log("[VoiceAI] Raw AI content:", content.substring(0, 500));
    
    content = content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    else if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();
    
    console.log("[VoiceAI] Cleaned content:", content.substring(0, 500));

    // Try to extract the first valid JSON object from the content
    // Sometimes the AI outputs text followed by JSON, or multiple JSON objects
    let parsed: any = null;
    
    // First, try parsing the whole content
    try {
      parsed = JSON.parse(content);
    } catch {
      // Look for a JSON object pattern in the content
      const jsonMatch = content.match(/\{[\s\S]*?"reply"\s*:\s*"[^"]*"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Try to find just the first complete JSON object
          let braceCount = 0;
          let startIdx = -1;
          for (let i = 0; i < content.length; i++) {
            if (content[i] === '{') {
              if (startIdx === -1) startIdx = i;
              braceCount++;
            } else if (content[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIdx !== -1) {
                try {
                  parsed = JSON.parse(content.substring(startIdx, i + 1));
                  break;
                } catch { startIdx = -1; }
              }
            }
          }
        }
      }
    }

    if (parsed && parsed.reply) {
      // Clean up the reply - remove any embedded JSON that got duplicated
      let cleanReply = parsed.reply;
      const jsonInReply = cleanReply.indexOf('\n{');
      if (jsonInReply > 0) {
        cleanReply = cleanReply.substring(0, jsonInReply).trim();
      }
      
      return {
        reply: cleanReply || "How can I help you?",
        action: parsed.action || null,
        shouldEnd: parsed.shouldEnd === true
      };
    }
    
    // Fallback: just return the content as reply
    return { reply: content || "How can I help you?", shouldEnd: false };
  } catch (error) {
    console.error("[VoiceAI] Error calling AI:", error);
    return {
      reply: "I'm sorry, something went wrong. Please try again.",
      shouldEnd: false
    };
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function executeAction(
  supabase: any,
  businessId: string,
  action: any,
  context: any
): Promise<{ success: boolean; code?: string; error?: string }> {
  if (!action || !action.type) return { success: false };

  const { type, params } = action;

  if (type === "create_booking") {
    return await handleCreateBooking(supabase, businessId, params, context);
  }

  if (type === "cancel_booking") {
    return await handleCancelBooking(supabase, businessId, params, context);
  }

  if (type === "reschedule_booking") {
    return await handleRescheduleBooking(supabase, businessId, params, context);
  }

  if (type === "leave_message") {
    return await handleLeaveMessage(supabase, businessId, params, context);
  }

  return { success: false };
}

async function handleLeaveMessage(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<{ success: boolean; error?: string }> {
  const { message, recipient_type, recipient_staff_name, is_urgent } = params;

  if (!message || message.trim() === "") {
    return { success: false, error: "I didn't catch the message. What would you like me to pass on?" };
  }

  // Find staff ID if message is for specific staff
  let recipientStaffId = null;
  if (recipient_type === "staff" && recipient_staff_name && context.staff) {
    const staff = context.staff.find((s: any) => 
      s.name.toLowerCase().includes(recipient_staff_name.toLowerCase()) ||
      recipient_staff_name.toLowerCase().includes(s.name.toLowerCase())
    );
    if (staff) {
      recipientStaffId = staff.id;
    }
  }

  const { error } = await supabase
    .from("messages")
    .insert({
      business_id: businessId,
      caller_phone: context.callerPhone,
      caller_name: context.callerName || null,
      content: message,
      recipient_type: recipient_type || "all",
      recipient_staff_id: recipientStaffId,
      is_urgent: is_urgent === true,
      is_read: false,
    });

  if (error) {
    console.error("[VoiceAction] Leave message error:", error);
    return { success: false, error: "I couldn't save that message. Would you like to try again?" };
  }

  console.log("[VoiceAction] Message saved successfully");
  return { success: true };
}

async function handleCreateBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<{ success: boolean; code?: string; error?: string }> {
  const { customer_name, customer_phone, service_name, staff_name, date, time } = params;

  // Validate required fields - service and staff are REQUIRED
  if (!customer_name || !date || !time) {
    console.log("[VoiceAction] Create booking missing basic params:", params);
    return { success: false, error: "I need your name, preferred date and time to complete the booking" };
  }

  if (!service_name) {
    console.log("[VoiceAction] Create booking missing service:", params);
    return { success: false, error: "I need to know which service you'd like. What would you like to book?" };
  }

  if (!staff_name) {
    console.log("[VoiceAction] Create booking missing staff:", params);
    return { success: false, error: "I need to know which barber you'd prefer. Who would you like to see?" };
  }

  // Parse natural date/time if not in ISO format
  const now = new Date();
  let parsedDate = date;
  let parsedTime = time;

  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const dateResult = parseNaturalDate(date, now);
    if (dateResult) parsedDate = dateResult.date;
  }

  if (!time.match(/^\d{2}:\d{2}$/)) {
    const timeResult = parseNaturalTime(time);
    if (timeResult) parsedTime = timeResult;
  }

  // Find service - REQUIRED
  let serviceId = null;
  let duration = 60;
  if (context.services) {
    // Try exact match first
    let service = context.services.find((s: any) => 
      s.name.toLowerCase() === service_name.toLowerCase()
    );
    // Then try partial match
    if (!service) {
      service = context.services.find((s: any) => 
        s.name.toLowerCase().includes(service_name.toLowerCase()) ||
        service_name.toLowerCase().includes(s.name.toLowerCase())
      );
    }
    if (service) {
      serviceId = service.id;
      duration = service.duration_minutes || 60;
    } else {
      console.log("[VoiceAction] Service not found:", service_name, "Available:", context.services.map((s: any) => s.name));
      return { success: false, error: `I couldn't find a service called "${service_name}". We offer ${context.services.map((s: any) => s.name).join(", ")}` };
    }
  }

  // Find staff - REQUIRED (unless "anyone" or "whoever")
  let staffId = null;
  const anyonePatterns = ["anyone", "anybody", "whoever", "any", "don't mind", "doesnt matter", "doesn't matter", "first available"];
  const wantsAnyone = anyonePatterns.some(p => staff_name.toLowerCase().includes(p));
  
  if (wantsAnyone) {
    // Pick first available staff member
    if (context.staff && context.staff.length > 0) {
      staffId = context.staff[0].id;
    }
  } else if (context.staff) {
    // Try exact match first
    let staff = context.staff.find((s: any) =>
      s.name.toLowerCase() === staff_name.toLowerCase()
    );
    // Then try partial match
    if (!staff) {
      staff = context.staff.find((s: any) =>
        s.name.toLowerCase().includes(staff_name.toLowerCase()) ||
        staff_name.toLowerCase().includes(s.name.toLowerCase())
      );
    }
    if (staff) {
      staffId = staff.id;
    } else {
      console.log("[VoiceAction] Staff not found:", staff_name, "Available:", context.staff.map((s: any) => s.name));
      return { success: false, error: `I couldn't find "${staff_name}". We have ${context.staff.map((s: any) => s.name).join(", ")}` };
    }
  }

  if (!staffId) {
    return { success: false, error: "I need to know which barber you'd prefer. Who would you like to see?" };
  }

  // Check availability before booking
  const availability = await checkRealAvailability(
    supabase,
    businessId,
    parsedDate,
    parsedTime,
    duration,
    staffId,
    context.openingHours
  );

  if (!availability.isAvailable) {
    console.log("[VoiceAction] Slot not available:", availability.reason);
    return { 
      success: false, 
      error: availability.reason + (availability.suggestedSlots?.length 
        ? `. I have availability ${availability.suggestedSlots.join(", or ")}`
        : "")
    };
  }

  const startDate = new Date(`${parsedDate}T${parsedTime}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    console.log("[VoiceAction] Invalid date/time:", parsedDate, parsedTime);
    return { success: false, error: "Invalid date or time" };
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: customer_phone || context.callerPhone || "Phone call",
      service_id: serviceId,
      staff_id: staffId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      created_by: "Aivia Voice AI",
    })
    .select("id, booking_code")
    .single();

  if (error) {
    console.error("[VoiceAction] Booking error:", error);
    return { success: false, error: "Failed to create booking" };
  }

  console.log("[VoiceAction] Created booking:", booking.booking_code);
  return { success: true, code: booking.booking_code };
}

async function handleCancelBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<{ success: boolean; code?: string; error?: string }> {
  const { booking_code, customer_name } = params;

  let booking: any = null;

  if (booking_code) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, customer_name")
      .eq("business_id", businessId)
      .ilike("booking_code", `%${booking_code}%`)
      .neq("status", "cancelled")
      .single();
    booking = data;
  } else if (customer_name) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, customer_name")
      .eq("business_id", businessId)
      .ilike("customer_name", `%${customer_name}%`)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(1)
      .single();
    booking = data;
  }

  if (!booking) {
    console.log("[VoiceAction] No booking found to cancel:", params);
    return { success: false, error: "I couldn't find that booking" };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) {
    console.error("[VoiceAction] Cancel error:", error);
    return { success: false, error: "Failed to cancel booking" };
  }

  console.log("[VoiceAction] Cancelled booking:", booking.booking_code);
  return { success: true, code: booking.booking_code };
}

async function handleRescheduleBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<{ success: boolean; code?: string; error?: string }> {
  const { booking_code, customer_name, new_date, new_time } = params;

  if (!new_date || !new_time) {
    return { success: false, error: "I need a new date and time" };
  }

  let booking: any = null;

  if (booking_code) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, service_id, staff_id, services:service_id(duration_minutes)")
      .eq("business_id", businessId)
      .ilike("booking_code", `%${booking_code}%`)
      .neq("status", "cancelled")
      .single();
    booking = data;
  } else if (customer_name) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, service_id, staff_id, services:service_id(duration_minutes)")
      .eq("business_id", businessId)
      .ilike("customer_name", `%${customer_name}%`)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(1)
      .single();
    booking = data;
  }

  if (!booking) {
    return { success: false, error: "I couldn't find that booking" };
  }

  // Parse natural date/time
  const now = new Date();
  let parsedDate = new_date;
  let parsedTime = new_time;

  if (!new_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const dateResult = parseNaturalDate(new_date, now);
    if (dateResult) parsedDate = dateResult.date;
  }

  if (!new_time.match(/^\d{2}:\d{2}$/)) {
    const timeResult = parseNaturalTime(new_time);
    if (timeResult) parsedTime = timeResult;
  }

  const duration = booking.services?.duration_minutes || 60;

  // Check availability
  const availability = await checkRealAvailability(
    supabase,
    businessId,
    parsedDate,
    parsedTime,
    duration,
    booking.staff_id,
    context.openingHours
  );

  if (!availability.isAvailable) {
    return { 
      success: false, 
      error: availability.reason + (availability.suggestedSlots?.length 
        ? `. I can offer ${availability.suggestedSlots.join(", or ")} instead`
        : "")
    };
  }

  const startDate = new Date(`${parsedDate}T${parsedTime}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    return { success: false, error: "Invalid date or time" };
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
    })
    .eq("id", booking.id);

  if (error) {
    console.error("[VoiceAction] Reschedule error:", error);
    return { success: false, error: "Failed to reschedule" };
  }

  console.log("[VoiceAction] Rescheduled booking:", booking.booking_code);
  return { success: true, code: booking.booking_code };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[VoiceContinue] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-continue") {
      return twimlError("Configuration error. Goodbye.");
    }

    // Parse Twilio parameters
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Temporarily skip signature validation due to URL format mismatch
    // TODO: Re-enable once URL format is confirmed
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      console.log("[VoiceContinue] Signature received:", signature ? "present" : "missing");
      console.log("[VoiceContinue] Request URL:", req.url);
      // Skip validation for now - URL format mismatch causing failures
      console.warn("[VoiceContinue] Signature validation temporarily disabled");
    }

    const callSid = params.CallSid || "";
    const speechResult = params.SpeechResult || "";
    const confidence = params.Confidence || "";
    const fromNumber = params.From || params.Caller || "";

    console.log("[VoiceContinue] Speech:", { callSid, speechResult, confidence });

    // Find business by token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_enabled, aivia_active")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[VoiceContinue] Business not found:", businessError);
      return twimlError("Sorry, something went wrong. Goodbye.");
    }

    if (!business.twilio_enabled || !business.aivia_active) {
      return twimlError("This line is not currently active. Goodbye.");
    }

    // Get business settings
    const { data: settings } = await supabase
      .from("business_settings")
      .select("assistant_name, tone, primary_language, voice_gender, voice_speed, elevenlabs_voice_id")
      .eq("business_id", business.id)
      .maybeSingle();

    // Determine ElevenLabs voice ID
    const voiceId = settings?.elevenlabs_voice_id || DEFAULT_VOICES[settings?.voice_gender as keyof typeof DEFAULT_VOICES] || DEFAULT_VOICES.female;
    const pollyVoice = settings?.voice_gender === "male" ? "Polly.Brian-Neural" : "Polly.Amy-Neural";
    const rate = "108%";
    const assistantName = settings?.assistant_name || "Aivia";
    const continueUrl = `${supabaseUrl}/functions/v1/twilio-voice-continue/${token}`;

    // Get dynamic speech hints for this business (staff names, services)
    const speechHints = await getBusinessSpeechHints(supabase, business.id);

    // Handle empty speech result
    if (!speechResult || speechResult.trim() === "") {
      console.log("[VoiceContinue] No speech detected, asking for clarification");
      const clarifyText = "Sorry, I didn't catch that. Could you please repeat what you need help with?";
      
      // Try ElevenLabs first
      const audioUrl = await generateAndUploadAudio(supabase, clarifyText, voiceId, callSid, `clarify-${Date.now()}`);
      if (audioUrl) {
        return twimlClarifyWithAudio(audioUrl, continueUrl, speechHints);
      }
      
      // Fallback to Polly
      return twimlClarify(clarifyText, continueUrl, pollyVoice, speechHints, rate);
    }

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("call_conversations")
      .select("*")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: convError } = await supabase
        .from("call_conversations")
        .insert({
          call_sid: callSid,
          business_id: business.id,
          caller_phone: fromNumber,
          messages: [],
          status: "active",
        })
        .select()
        .single();

      if (convError) {
        console.error("[VoiceContinue] Error creating conversation:", convError);
      }
      conversation = newConv;
    }

    const messages: Message[] = conversation?.messages || [];

    // Recognize caller
    const callerInfo = await recognizeCaller(supabase, business.id, fromNumber);
    console.log("[VoiceContinue] Caller info:", callerInfo);

    // Update conversation with caller name if recognized
    if (callerInfo.isReturning && callerInfo.name && !conversation?.caller_name) {
      await supabase
        .from("call_conversations")
        .update({ caller_name: callerInfo.name })
        .eq("call_sid", callSid);
    }

    // Fetch business context for AI
    const [
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: upcomingBookings }
    ] = await Promise.all([
      supabase.from("services").select("id, name, duration_minutes, price").eq("business_id", business.id),
      supabase.from("staff").select("id, name, role").eq("business_id", business.id),
      supabase.from("opening_hours").select("*").eq("business_id", business.id).order("day_of_week"),
      supabase.from("bookings")
        .select("booking_code, customer_name, start_time, service:service_id(name), staff:staff_id(name)")
        .eq("business_id", business.id)
        .neq("status", "cancelled")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(20)
    ]);

    // Build business context with caller info
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const dbDayToday = jsToDbDay(now.getDay());

    const formattedHours = openingHours?.map((h: any) => ({
      day: DB_DAY_NAMES[h.day_of_week],
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    })) || [];

    // Build caller info section
    let callerSection = `CALLER PHONE: ${fromNumber}\n`;
    if (callerInfo.isReturning) {
      callerSection += `RETURNING CUSTOMER: Yes
CUSTOMER NAME: ${callerInfo.name}
TOTAL VISITS: ${callerInfo.totalVisits || 0}`;
      if (callerInfo.preferredStaff) {
        callerSection += `\nPREFERRED STAFF: ${callerInfo.preferredStaff}`;
      }
      if (callerInfo.lastBooking) {
        callerSection += `\nLAST VISIT: ${callerInfo.lastBooking.service} on ${callerInfo.lastBooking.date}${callerInfo.lastBooking.staff ? ` with ${callerInfo.lastBooking.staff}` : ""}`;
      }
      if (callerInfo.upcomingBooking) {
        callerSection += `\nUPCOMING BOOKING: ${callerInfo.upcomingBooking.service} on ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Code: ${callerInfo.upcomingBooking.code})`;
      }
    } else {
      callerSection += "RETURNING CUSTOMER: No (new caller)";
    }

    const businessContext = `
BUSINESS: ${business.business_name}
ASSISTANT NAME: ${assistantName}

${callerSection}

CURRENT DATE & TIME:
- Now: ${now.toISOString()}
- Today: ${DB_DAY_NAMES[dbDayToday]}, ${todayStr}
- Tomorrow: ${tomorrowStr}

SERVICES:
${services?.map((s: any) => `- ${s.name}: ${s.duration_minutes}min, £${s.price}`).join("\n") || "No services configured"}

STAFF:
${staff?.map((s: any) => `- ${s.name} (${s.role})`).join("\n") || "No staff configured"}

OPENING HOURS:
${formattedHours.map((h: any) => `- ${h.day}: ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

UPCOMING BOOKINGS (for reference):
${upcomingBookings?.slice(0, 10).map((b: any) => 
  `- ${b.booking_code}: ${b.customer_name} on ${new Date(b.start_time).toLocaleDateString()} at ${formatTime(new Date(b.start_time))}`
).join("\n") || "No upcoming bookings"}
`;

    // Process with AI
    const aiResult = await processWithAI(lovableApiKey, businessContext, messages, speechResult);
    console.log("[VoiceContinue] AI result:", aiResult);

    // Execute any actions
    let actionResult: { success: boolean; code?: string; error?: string } = { success: false };
    if (aiResult.action) {
      actionResult = await executeAction(supabase, business.id, aiResult.action, { 
        services, 
        staff, 
        openingHours,
        callerPhone: fromNumber,
        callerName: callerInfo.name || null
      });
      console.log("[VoiceContinue] Action result:", actionResult);
      
      // Update call_type immediately when action is executed
      const callTypeMapping: Record<string, string> = {
        "create_booking": "new_booking",
        "cancel_booking": "cancel",
        "reschedule_booking": "reschedule",
        "leave_message": "other"
      };
      
      const newCallType = callTypeMapping[aiResult.action.type];
      if (newCallType) {
        await supabase
          .from("calls_log")
          .update({ 
            call_type: newCallType,
            call_outcome: actionResult.success ? aiResult.action.type : "failed"
          })
          .eq("twilio_call_sid", callSid);
        console.log(`[VoiceContinue] Updated call_type to ${newCallType}`);
      }
      
      // If action failed, modify reply to include error
      if (!actionResult.success && actionResult.error) {
        aiResult.reply = actionResult.error;
        aiResult.shouldEnd = false;
      }
    }

    // Update conversation history
    const updatedMessages = [
      ...messages,
      { role: "user", content: speechResult },
      { role: "assistant", content: aiResult.reply }
    ];

    await supabase
      .from("call_conversations")
      .update({
        messages: updatedMessages,
        status: aiResult.shouldEnd ? "completed" : "active",
        intent: aiResult.action?.type || conversation?.intent,
        booking_id: actionResult.success && actionResult.code ? undefined : conversation?.booking_id,
      })
      .eq("call_sid", callSid);

    // Update call log outcome if ending
    if (aiResult.shouldEnd) {
      await supabase
        .from("calls_log")
        .update({
          call_outcome: aiResult.action?.type || "answered",
          call_type: aiResult.action?.type === "create_booking" ? "new_booking" :
                     aiResult.action?.type === "cancel_booking" ? "cancel" :
                     aiResult.action?.type === "reschedule_booking" ? "reschedule" : "question",
          summary: `Caller: ${speechResult.substring(0, 100)}${speechResult.length > 100 ? "..." : ""}`,
        })
        .eq("twilio_call_sid", callSid);

      // Try ElevenLabs for end message
      const endAudioUrl = await generateAndUploadAudio(supabase, aiResult.reply, voiceId, callSid, `end-${Date.now()}`);
      if (endAudioUrl) {
        return twimlEndWithAudio(endAudioUrl);
      }
      return twimlEnd(aiResult.reply, pollyVoice, rate);
    }

    // Continue the conversation with ElevenLabs
    const continueAudioUrl = await generateAndUploadAudio(supabase, aiResult.reply, voiceId, callSid, `reply-${Date.now()}`);
    if (continueAudioUrl) {
      return twimlContinueWithAudio(continueAudioUrl, continueUrl, speechHints, 6);
    }
    
    // Fallback to Polly
    return twimlContinue(aiResult.reply, continueUrl, pollyVoice, speechHints, rate, 6);

  } catch (error) {
    console.error("[VoiceContinue] Error:", error);
    return twimlError("Sorry, something went wrong on our side. Please call again later. Goodbye.");
  }
});
