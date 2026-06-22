## What you asked, and where it already works vs. what's missing

I dug through the voice AI code. Most of what you described is already enforced, but a few gaps are real. Here's the honest state of each, and what I'll change.

### 1. Staff schedule (no bookings when staff isn't working)
**Already enforced.** `check_availability` reads `staff.working_hours` and `staff_time_off`, and only returns slots that fall inside that staff's working days/hours. If Sarah doesn't work Friday, Friday won't be offered for Sarah. The AI also has the working days printed into its prompt as `[WORKS: Mon, Tue, Wed...]` so it won't even suggest it.
**Change:** none needed beyond a small prompt tighten so the AI re-states the constraint when a caller insists on a closed day.

### 2. Staff can only be booked for services they actually do
**Already enforced.** Each staff line in the prompt says `[CAN ONLY BOOK FOR: ...]`, and `create_booking` re-verifies the staff↔service link server-side before writing. The staff banner you have now (added last turn) flags any service with zero staff so this gap is visible in the dashboard too.
**Change:** none in code. Banner already covers Lucy's missing assignments.

### 3. AI getting the date/time right ("2pm Thursday" must become Thursday 2pm)
**Mostly already there** — the prompt injects today's full date + timezone, and `check_availability` / `create_booking` parse the date the AI passes. The risk is the AI mishearing "two" vs "twelve" or "Thursday this week" vs "next Thursday".
**Change:**
- Before calling `create_booking`, force the AI to **read the date + time + day-of-week back to the caller** ("So that's Thursday the 26th at 2 PM, correct?") and only call the tool after a yes. This is a prompt rule, not new code.
- Server-side: in `create_booking`, double-check the day-of-week of the parsed date matches what the AI said in the confirmation (logged for audit). If mismatch, refuse and ask the AI to reconfirm.

### 4. Transfer to owner or a named staff member
**Partly works.** Today the AI will transfer to anyone with a phone number on file via the `transfer_call` tool. Per your answer, you want a **per-staff toggle** instead so not every staff phone becomes transferable.
**Changes:**
- Migration: add `staff.transferable_to_calls boolean default false`, plus auto-set true for `is_business_owner`.
- `StaffManagement.tsx`: add a "Callers can be transferred to this person" toggle on the staff form (locked-on for the owner).
- `twilio-media-stream/index.ts`:
  - `executeTransferCall` rejects staff where `transferable_to_calls = false` (unless owner) with: "I can take a message for [name] instead."
  - Staff list injected into the prompt is annotated `[TRANSFERABLE]` so the AI knows who it can offer to transfer to.
  - The prompt explicitly handles "can I speak to the owner / [name]?" → call `transfer_call` if transferable, else offer `leave_message`.

### 5. Organise bookings to avoid big gaps
**Sort already exists** but it's applied to *every* availability response, which can be annoying when a caller asks for a specific time. Per your answer, only do gap-packing when the caller is flexible; honour exact requests as-is.
**Changes in `executeCheckAvailability`:**
- Add a `flexible` boolean param the AI passes (true when caller said "any time", "whenever", "what's free", "first appointment Thursday"; false when caller named a specific time).
- If `flexible = true` → return slots sorted tightest-to-existing-booking first (current behaviour), and the AI offers the top 1–2 as "I've got 10:30 right after another appointment — does that work?"
- If `flexible = false` → return slots in normal time order and check the exact requested time first; do not "nudge" the caller toward a gap-filler.
- Prompt update: teach the AI when to set `flexible=true` vs `false`, and to proactively suggest the tightest slot only in the flexible case.

### Files to touch
- `supabase/migrations/<new>.sql` — add `staff.transferable_to_calls`
- `src/components/dashboard/settings/StaffManagement.tsx` — toggle in the form + list badge
- `supabase/functions/twilio-media-stream/index.ts` — transfer gate, `flexible` param on `check_availability`, day-of-week sanity check in `create_booking`, prompt updates (staff annotation, confirm-read-back rule, flexible-vs-exact rule)
- `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` — same prompt rules surfaced for salons
- `supabase/functions/public-check-availability/index.ts` — leave as-is (the public booking page already shows all slots chronologically; gap-packing is a voice-AI concern only)

### Out of scope (flag for later if you want)
- Auto-rearranging *existing* future bookings to close gaps. You picked "only when caller is flexible", so I'm not building the dashboard "compact schedule" suggester. Easy to add later.
- Restaurant/dine-in flows — same `flexible` logic could extend to `check_table_availability` but I'll keep this change to salon bookings unless you say otherwise.
