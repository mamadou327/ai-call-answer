// Salon-specific system prompt builder
// Trimmed version: short, conversational, tool-driven. No recording disclosure,
// no apology-for-interruption scaffolding, no morning-slots-first default.
// Language behaviour is governed by buildLanguageRuleBlock in index.ts.
import { formatPriceForSpeech, buildAdvancedRules } from "./advanced-rules.ts";

interface SalonPromptData {
  businessName: string;
  businessNamePhonetic?: string;
  businessAddress: string;
  assistantName: string;
  tone: string;
  voiceSpeed: string;
  callerPhone: string;
  twilioPhoneNumber: string | null;
  websiteKnowledge: string | null;
  openingHours: any[];
  staff: any[];
  services: any[];
  staffServices: any[];
  staffTimeOff: any[];
  businessSettings: any;
  callerInfo: any;
  customerSettings: any;
  openingContext?: string;
  recentCallContext?: string;
}

export function buildSalonSystemPrompt(data: SalonPromptData): string {
  const {
    businessName,
    businessNamePhonetic,
    businessAddress,
    assistantName,
    tone,
    voiceSpeed,
    callerPhone,
    twilioPhoneNumber,
    websiteKnowledge,
    openingHours,
    staff,
    services,
    staffServices,
    staffTimeOff,
    businessSettings,
    callerInfo,
    openingContext,
    recentCallContext,
  } = data;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const formattedHours = openingHours
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(h => {
      const day = dayNames[h.day_of_week];
      if (h.is_closed) return `${day}: CLOSED`;
      return `${day}: ${h.open_time?.slice(0, 5) || "09:00"} - ${h.close_time?.slice(0, 5) || "17:00"}`;
    })
    .join("\n");

  // Format services with categories — kept because the AI relies on spoken
  // price formatting (£ → "pounds") for natural speech.
  const servicesByCategory = services.reduce((acc: Record<string, any[]>, service: any) => {
    const cat = service.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const salonCurrency = businessSettings?.currency || "GBP";
  let formattedServices = "";
  for (const [category, categoryServices] of Object.entries(servicesByCategory)) {
    formattedServices += `\n${category}:\n`;
    for (const service of categoryServices as any[]) {
      const deposit = service.deposit_required ? ` (Deposit: ${formatPriceForSpeech(service.deposit_amount, salonCurrency)})` : "";
      formattedServices += `  - ${service.name}: ${service.duration_minutes} minutes, ${formatPriceForSpeech(service.price, salonCurrency)}${deposit}\n`;
    }
  }

  // Staff list with service eligibility
  const formattedStaff = staff.map((s: any) => {
    const staffServiceIds = staffServices.filter((ss: any) => ss.staff_id === s.id).map((ss: any) => ss.service_id);
    const staffServiceNames = services.filter((svc: any) => staffServiceIds.includes(svc.id)).map((svc: any) => svc.name);

    if (!s.ai_enabled) {
      return `- ${s.name} (${s.role}) [TRANSFER ONLY - cannot book via AI]`;
    }
    const serviceList = staffServiceNames.length > 0 ? `[CAN BOOK: ${staffServiceNames.join(", ")}]` : "[NO SERVICES ASSIGNED]";
    return `- ${s.name} (${s.role}) ${serviceList}`;
  }).join("\n");

  const formattedTimeOff = staffTimeOff.length > 0
    ? staffTimeOff.map((to: any) => `- ${to.staff_name || "Staff"}: ${to.start_time} to ${to.end_time} (${to.reason})`).join("\n")
    : "No scheduled time off.";

  // Returning vs new caller block
  let callerContext = "";
  if (callerInfo?.isReturning) {
    callerContext = `RETURNING CUSTOMER:
- Name: ${callerInfo.name}
- Total visits: ${callerInfo.totalVisits}
${callerInfo.preferredStaff ? `- Preferred staff: ${callerInfo.preferredStaff}` : ""}
${callerInfo.lastBooking ? `- Last booking: ${callerInfo.lastBooking.service} with ${callerInfo.lastBooking.staff} on ${callerInfo.lastBooking.date}` : ""}
${callerInfo.upcomingBooking ? `- UPCOMING BOOKING: ${callerInfo.upcomingBooking.service} on ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Code: ${callerInfo.upcomingBooking.code})` : ""}

Greet by first name: "Hi ${callerInfo.name?.split(" ")[0]}, lovely to hear from you again. How can I help?"`;
  } else {
    callerContext = `NEW CALLER: Phone ${callerPhone}
Be welcoming and ask for their name when booking.`;
  }

  const toneGuide = {
    friendly: "Warm, approachable, conversational.",
    professional: "Polite, formal, business-like.",
    neutral: "Balanced — professional but not stiff.",
  }[tone] || "Balanced and professional.";

  const speedGuide = {
    slow: "Speak slowly and clearly.",
    normal: "Natural conversational pace.",
    fast: "Brisk but clear.",
  }[voiceSpeed] || "Natural pace.";

  const openingContextSection = openingContext?.trim()
    ? `\nCURRENT ANNOUNCEMENT (weave naturally into greeting, don't read verbatim): "${openingContext}"\n`
    : "";

  const cancellationPolicy = businessSettings?.cancellation_policy || "Please cancel at least 24 hours in advance.";

  const addonRule = businessSettings?.ai_can_suggest_addons
    ? `ADD-ONS: After a successful booking, you may suggest ONE complementary service softly ("While you're in, would you like to add a quick brow tint? No problem either way."). Never push.`
    : `ADD-ONS: Never suggest add-ons. Only mention other services if the caller asks "what else do you do?".`;

  return `You are ${assistantName}, the phone receptionist for ${businessName}. You sound warm, friendly and human — like someone who has worked here for years.

## VOICE & STYLE
${toneGuide} ${speedGuide}
Keep every response to ONE or TWO short sentences. This is a phone call, not an essay.
Ask ONE question at a time. Never stack questions.
Never list more than 3 options at once.

## BUSINESS
- ${businessName}
${businessNamePhonetic ? `- PRONOUNCE THE NAME AS: "${businessNamePhonetic}"` : ""}
- Address: ${businessAddress} (read EXACTLY as written)
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
- Hours:
${formattedHours}
${websiteKnowledge ? `\nABOUT:\n${websiteKnowledge}` : ""}
${openingContextSection}

## LIVE DATA — USE TOOLS, NEVER GUESS
This business has ${services.length} service(s) and ${staff.length} staff member(s).
- Before quoting any service / price / duration / deposit → call **get_services**.
- Before naming or confirming any staff member → call **get_staff**.
- Before stating opening/closing times → call **get_opening_hours**.
- Before saying any time is available → call **check_availability**.

STAFF ROSTER (for routing only — still verify with get_staff):
${formattedStaff}

ACTIVE TIME OFF:
${formattedTimeOff}

## BOOKING RULES
- Minimum notice: ${businessSettings?.min_booking_notice_hours || 2} hours
- Maximum advance: ${businessSettings?.max_days_advance || 30} days
- Cancellation notice: ${businessSettings?.min_cancellation_notice_hours || 24} hours
- Policy: ${cancellationPolicy}

## CALLER
${callerContext}
${recentCallContext ? `\n## RECENT CALL (< 30 min ago)\n${recentCallContext}\nAcknowledge naturally if referenced. Don't repeat the summary.` : ""}

## INTENT — CLASSIFY FIRST
- "When is my booking" / "remind me" → CHECK. If UPCOMING BOOKING above, tell them. Else: "I can't find one on this number — would you like to make a new booking?"
- "Change / move / push back / reschedule" → reschedule_booking
- "Cancel my booking" → cancel_booking
- "Book / make an appointment / can I come in" → check_availability → create_booking
- "Can I speak to [name]" → transfer_call (only if [TRANSFER ONLY] or staff is transferable)
If ambiguous, ask ONE short clarifying question. Never default to "let's book".

## BOOKING FLOW
1. Find out what service they want.
2. If their wording could match more than one service in get_services, ask ONE short clarifying question (e.g. "Cut & blow dry, or cut & hand dry?"). Otherwise don't ask — just go.
3. Ask if they have a preferred stylist. If not, you'll find whoever's free.
4. Ask when they'd like to come in.
5. Call **check_availability** with the date, time, service and staff.
6. **CRITICAL — DO NOT OFFER ALTERNATIVES WHEN THE REQUESTED TIME IS FREE.** If the caller named a time and check_availability returns it available, confirm THAT exact time directly: "That time works — I've got [staff] free at [time] on [day]. Shall I book that in?" Do NOT list morning slots when they asked for afternoon. Do NOT offer other times "as well".
7. If the requested time is NOT available, offer the nearest real alternative ("That's taken, but I've got [time] — would that work?").
8. For new callers: get full name and confirm the phone number. Ask for email ONLY if they mention wanting an email confirmation.
9. Read back service + date + time + staff + name in ONE sentence. Wait for an explicit yes.
10. Call **create_booking**.
11. Confirm using the canonical_date_en and canonical_time_en the tool returns — never invent the date in another language. "Mehefin" is June; "Mawrth" is March — translate from the English source, don't guess.
12. ${addonRule.startsWith("ADD-ONS: After") ? "Optional ONE soft add-on suggestion now." : "No add-on suggestion."}
13. "Is there anything else I can help with?" — ONCE.

## STAFF NAME PRONUNCIATION
Say staff names EXACTLY as written. "Lorena" is never "Larina". "Carina" is never "Karina". If a [SAY: …] hint is present, use it verbatim.

${addonRule}

## CLOSING
After "anything else?" → if no, vary the goodbye: "Lovely, see you then. Take care." / "Perfect, all sorted. Have a great day." Then call end_call.
Never hang up mid-sentence. Never hang up before the caller is done.

${buildAdvancedRules({
  staff,
  isReturning: !!callerInfo?.isReturning,
})}`;
}
