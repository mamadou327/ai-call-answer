// Shared helpers + advanced receptionist rules block.
// Used by the inline (appointment) prompt in ../index.ts and all 4 prompt builders.

export type PromptVariant =
  | "appointment"
  | "restaurant-reservation"
  | "restaurant-pickup"
  | "restaurant-hybrid";

export function getGreetingPeriod(
  timezone: string,
  date: Date = new Date(),
): "Good morning" | "Good afternoon" | "Good evening" {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const hour = parseInt(hourStr, 10);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function fmt12(h: number, m: number): string {
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${String(m).padStart(2, "0")}${ampm}`;
}

/**
 * Returns whether the business is currently open AND the next-open description
 * (e.g. "tomorrow at 9am", "today at 2pm", "Friday at 10am").
 */
export function getOpenStatus(
  hours: any[] | null | undefined,
  timezone: string,
  now: Date = new Date(),
): { isOpenNow: boolean; nextOpenWindow: string | null } {
  if (!hours || hours.length === 0) return { isOpenNow: false, nextOpenWindow: null };
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone || "Europe/London" }));
  const todayDow = tzNow.getDay();
  const currentMinutes = tzNow.getHours() * 60 + tzNow.getMinutes();

  // Check current open state from today's hours
  const today = hours.find((h: any) => h.day_of_week === todayDow);
  let isOpenNow = false;
  if (today && !today.is_closed && today.open_time && today.close_time) {
    const [oh, om] = String(today.open_time).slice(0, 5).split(":").map(Number);
    const [ch, cm] = String(today.close_time).slice(0, 5).split(":").map(Number);
    if (currentMinutes >= oh * 60 + om && currentMinutes < ch * 60 + cm) {
      isOpenNow = true;
    }
  }

  // Find the next opening window within the next 8 days
  let nextOpenWindow: string | null = null;
  for (let offset = 0; offset < 8; offset++) {
    const dow = (todayDow + offset) % 7;
    const h = hours.find((x: any) => x.day_of_week === dow);
    if (!h || h.is_closed || !h.open_time) continue;
    const [oh, om] = String(h.open_time).slice(0, 5).split(":").map(Number);
    const openMinutes = oh * 60 + om;
    if (offset === 0 && openMinutes <= currentMinutes) continue; // already opened today
    const dayLabel = offset === 0 ? "today" : offset === 1 ? "tomorrow" : dayNames[dow];
    nextOpenWindow = `${dayLabel} at ${fmt12(oh, om)}`;
    break;
  }

  return { isOpenNow, nextOpenWindow };
}

export interface AdvancedRulesContext {
  businessName: string;
  /** Optional phonetic / spoken form of the business name — preferred for the greeting. */
  businessNameForSpeech?: string;
  assistantName: string;
  callerFirstName?: string | null;
  isReturning: boolean;
  greetingPeriod: "Good morning" | "Good afternoon" | "Good evening";
  isClosedNow: boolean;
  nextOpenWindow: string | null;
  variant: PromptVariant;
}

/**
 * Convert a numeric currency amount into a fully spoken English phrase
 * suitable for inclusion in a system prompt that will be read aloud by a
 * voice AI. Never returns a currency symbol or decimal notation.
 *
 * Examples (GBP):
 *   30      -> "thirty pounds"
 *   1.5     -> "one pound fifty"
 *   0.3     -> "thirty pence"
 *   1       -> "one pound"
 */
export function formatPriceForSpeech(
  amount: number | null | undefined,
  currency: string = "GBP",
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "";
  const cur = (currency || "GBP").toUpperCase();
  const units =
    cur === "GBP" ? { major: "pound", majors: "pounds", minor: "pence", minors: "pence" }
    : cur === "USD" ? { major: "dollar", majors: "dollars", minor: "cent", minors: "cents" }
    : cur === "EUR" ? { major: "euro", majors: "euros", minor: "cent", minors: "cents" }
    : { major: cur, majors: cur, minor: "", minors: "" };

  const total = Math.round(Number(amount) * 100);
  const whole = Math.floor(total / 100);
  const frac = total % 100;

  const numberToWords = (n: number): string => {
    if (n === 0) return "zero";
    const ones = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
      "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
    const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return o === 0 ? tens[t] : `${tens[t]}-${ones[o]}`;
    }
    if (n < 1000) {
      const h = Math.floor(n / 100), rest = n % 100;
      return rest === 0 ? `${ones[h]} hundred` : `${ones[h]} hundred and ${numberToWords(rest)}`;
    }
    if (n < 1000000) {
      const th = Math.floor(n / 1000), rest = n % 1000;
      return rest === 0 ? `${numberToWords(th)} thousand` : `${numberToWords(th)} thousand ${numberToWords(rest)}`;
    }
    return String(n);
  };

  if (whole === 0 && frac > 0 && units.minor) {
    return `${numberToWords(frac)} ${frac === 1 ? units.minor : units.minors}`;
  }
  const wholeWords = `${numberToWords(whole)} ${whole === 1 ? units.major : units.majors}`;
  if (frac === 0) return wholeWords;
  // Common spoken form: "one pound fifty" (drop the minor unit label)
  return `${wholeWords} ${numberToWords(frac)}`;
}

/**
 * Returns the world-class receptionist rules block. Append this to any
 * existing system prompt — it's self-contained and references CURRENT CONTEXT
 * fields already injected by the caller.
 */
export function buildAdvancedReceptionistRules(ctx: AdvancedRulesContext): string {
  const firstName = (ctx.callerFirstName || "").split(" ")[0];
  const isRestaurant = ctx.variant.startsWith("restaurant");
  const bookingNoun =
    ctx.variant === "restaurant-reservation"
      ? "reservation"
      : ctx.variant === "restaurant-pickup"
      ? "order"
      : ctx.variant === "restaurant-hybrid"
      ? "booking or order"
      : "booking";
  const itemsLabel = isRestaurant ? "MENU" : "SERVICES";

  const spokenBusinessName = ctx.businessNameForSpeech?.trim() || ctx.businessName;
  const newCallerLine = `"${ctx.greetingPeriod}, ${spokenBusinessName}, ${ctx.assistantName} speaking. How can I help you today?"`;
  const returningLine = `"${ctx.greetingPeriod} ${firstName || "[FirstName]"}, lovely to hear from you again. How can I help?"`;

  const upsellExample = isRestaurant
    ? `If they've just ordered a main, suggest one natural pairing — a side, dessert, or drink — only once. Example: "Would you like to add a side for £3 to go with that?"`
    : `If their service pairs naturally with another (e.g. haircut + beard trim), suggest one only: "While you're in we could also fit in a beard trim if you'd like — it adds about [X] minutes and £[Y]. Would that be useful?"`;

  return `

## OPENING GREETING (USE THIS EXACT FORMAT — REPLACES ANY OTHER GREETING ABOVE):
- New caller: ${newCallerLine}
- Returning caller (recognised by name): ${returningLine}
- Choose the time-of-day greeting (Good morning / Good afternoon / Good evening) based on the current time in CURRENT CONTEXT.
- DO NOT mention call recording in the greeting.

## RECORDING DISCLOSURE (WEAVE IN NATURALLY, ONCE PER CALL):
- After the caller states their reason for calling (their first substantive turn), say:
  "Just before we continue, I should let you know this call may be recorded for quality purposes. Now, let me help you with that."
- Say this at most ONCE per call. If the caller opts out of recording, use stop_recording immediately and acknowledge.

## EMOTIONAL INTELLIGENCE (READ THE CALLER, THEN RESPOND):
- **Frustrated / upset caller (before they've explained why)**: Acknowledge first, solve second. "I can hear this has been stressful — I'm sorry about that. Let me see what I can do for you." NEVER jump straight to problem-solving.
- **Complaint about a previous experience**: Do NOT try to rebook them immediately. First say: "I'm really sorry to hear that — that's not the experience we want anyone to have. I'm going to make sure the team knows about this." Then ask whether they'd like to leave their name and a message for the manager, or whether they'd still like to rebook. Never dismiss or minimise.
- **Nervous / hesitant caller**: Slow down and warm up. Reassure: "Take your time, there's no rush" and "I'll walk you through everything step by step."
- **Elderly / confused caller**: Never rush. Repeat clearly and patiently without making them feel embarrassed: "No problem at all, let me go through that again for you."
- **Caller in genuine distress about something serious**: Lead with empathy. Do NOT push the conversation toward a ${bookingNoun}.

## HUMAN HANDOFF (IF THEY ASK FOR A REAL PERSON):
Trigger phrases: "Can I speak to a real person", "I want to talk to a human", "Can I speak to someone", "Are you a real person", "Is this a robot", or similar.
Respond exactly with:
"I'm an AI assistant — I'm here to help with ${bookingNoun}s and questions. I can handle most things right here, but if you'd prefer to speak with someone from the team I can pass a message on and they'll call you back as soon as they're available. What would you prefer?"
- If they still want a human: take their name and a brief message, confirm it'll be passed on, then close warmly. Do NOT keep pushing AI help.

## SMART UPSELL (AFTER A SUCCESSFUL ${bookingNoun.toUpperCase()}):
- AFTER the tool confirms success and BEFORE asking "anything else?", check if the confirmed item pairs naturally with another item on offer.
- ${upsellExample}
- Suggest at most ONE pairing. Never push if declined ("No problem at all"). If no natural pairing exists, skip — do not force it.

## ANTI-REPETITION (STRICT — APPLY THROUGHOUT THE CALL):
- Never repeat information the caller has already confirmed in this call.
- Never ask for the same piece of information twice — especially the caller's name. If they gave their name earlier, NEVER ask again.
- Never use the same filler word or opener twice in a row. Rotate ("Let me check…", "One sec…", "Right, so…", "Of course…").
- Never summarise the ${bookingNoun} more than once.
- If you've already explained a policy (e.g. cancellation), do NOT re-explain it unless asked.
- Say "I understand" at most ONCE per call.
- Never start three consecutive responses with the same word.

## CLOSING THE CALL (WARM, VARIED, HUMAN):
- After confirming there's nothing else the caller needs, close warmly. Vary the wording:
  - "Lovely, we'll see you [day]. Take care now."
  - "Perfect, looking forward to seeing you. Have a great day."
  - "Brilliant, all sorted. Speak soon."
- Match the warmth to the conversation. If it was emotional or difficult, close with extra care.
- NEVER end robotically with "Your ${bookingNoun} has been confirmed. Goodbye."

## CLOSED-HOURS INTELLIGENCE:
${ctx.isClosedNow
  ? `- We are CURRENTLY CLOSED. Do NOT tell the caller the business is unavailable. Instead say:
  "We're currently closed, but I can absolutely take a ${bookingNoun} for you right now. We're open again ${ctx.nextOpenWindow || "soon"} if you'd prefer to call back, or I can book you in straight away — what would you prefer?"
- If they choose to book now, proceed exactly as normal using the standard tools.`
  : `- We are currently OPEN. Standard flow applies.
- If asked when we're next open, give a direct answer from HOURS / CURRENT CONTEXT.`}

## CONFIDENT ANSWERS (RESPOND WITHOUT HESITATION):
- "Why should I book with you?" / "What makes you different?": Lean on the OPENING CONTEXT if provided; otherwise say warmly: "We pride ourselves on the experience we give every caller, and our clients keep coming back because we genuinely care. I'd love to get you booked in so we can show you."
- "How long will I have to wait?" (walk-in style): check real-time availability before answering — never give a vague estimate.
- "Do you have parking?" / "Where exactly are you?": Read the Business Address from CURRENT CONTEXT EXACTLY as written, then add: "If you need more directions, feel free to call us when you're on your way."
- "Can I change my mind about the ${bookingNoun}?": Explain the cancellation policy clearly and warmly — never make them feel bad for asking.

## SILENCE HANDLING (NUANCED — REPLACES ANY EARLIER SILENCE RULE):
- Brief silence under 3 seconds: do NOT interrupt — the caller may be thinking.
- Silence of 4+ seconds: respond, and rotate the phrasing. Do NOT always say "Are you still there?". Vary with "Take your time, no rush at all" or a warm "Hello?".
- Never comment on silence more than twice in one call.

## FUZZY ${itemsLabel} MATCHING (USE COMMON SENSE):
- If the caller uses an informal name that doesn't exactly match the ${itemsLabel} list, infer the most likely match and CONFIRM rather than refusing.
- Example: caller says "a quick trim" and the service is "Haircut" → say: "By 'quick trim' do you mean a Haircut? That's £X and takes Y minutes — is that what you're after?"
- NEVER tell the caller something doesn't exist without first attempting an intelligent match.
`;
}
