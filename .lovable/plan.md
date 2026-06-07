## Goal

Give you full control of when Aria is allowed to book demos. She must:
- Only offer slots inside your weekly working hours
- Skip any date/time you've blocked from the calendar
- Never double-book (avoid slots already in the demos calendar)
- Apply sensible defaults: 15-min demo length, 15-min buffer, min 2-hour notice, max 4 demos/day (you can change these later)

---

## What you'll see in the admin

A new **"Availability"** tab in the outbound section with two parts:

**1. Weekly hours** — for each weekday: enabled toggle + start/end time (e.g. Mon–Fri 10:00–17:00). Plus four guardrail fields: demo length, buffer between demos, minimum notice, max demos/day.

**2. Calendar overrides** — on the existing Demos calendar, click any day to open the day view (already built), then a new "Block this day" or "Block a time range" action. Blocks show up visually on the calendar in red and override the weekly hours.

---

## How Aria uses it on the call

When a prospect agrees to a demo:

1. Aria calls a `get_available_slots` tool which returns the next ~10 free slots (e.g. "Tue 9 Jun 10:00, Tue 9 Jun 10:30, Wed 10 Jun 14:00…") computed live from: weekly hours − overrides − existing demos − minimum notice.
2. She offers 2–3 of those naturally ("I've got Tuesday at 10 or Wednesday at 2, which works better?").
3. When the prospect picks one, she calls `book_demo_slot` which re-validates the slot server-side and inserts into `outbound_demos`. If the slot was just taken or falls outside hours, the tool returns an error and Aria offers an alternative — she never verbally confirms before the DB succeeds (existing project rule).

---

## Technical details

**Database** — new migration:
- `outbound_availability` (single row, super_admin-owned): `weekly_hours jsonb` (per-weekday open/close), `demo_duration_minutes int default 15`, `buffer_minutes int default 15`, `min_notice_hours int default 2`, `max_demos_per_day int default 4`, `timezone text default 'Europe/London'`.
- `outbound_availability_overrides`: `date date`, `start_time time null`, `end_time time null`, `reason text` — full-day block when both times null, otherwise time-range block.
- Both tables: GRANTs, RLS restricted to `super_admin` via `has_role(auth.uid(), 'super_admin')`.

**Edge function updates** to `twilio-outbound-media-stream`:
- Inject availability summary into Aria's system prompt at session start (weekly hours + override notes for next 14 days).
- Register two OpenAI Realtime tools: `get_available_slots(from_date, days=7)` and `book_demo_slot(datetime_iso, prospect_name, prospect_business, prospect_phone, prospect_email)`.
- Slot computation runs server-side: generate candidate slots from weekly hours, subtract overrides, subtract existing `outbound_demos` (with buffer), enforce min-notice and daily cap.
- `book_demo_slot` re-runs the same validation atomically before insert; on success returns `{ ok: true, demo_id }`, on failure returns `{ ok: false, reason }` so Aria offers an alternative.

**Admin UI** — extend `OutboundCampaignsSection.tsx`:
- New `AvailabilityTab` (weekday rows + guardrail fields, save button).
- Day-detail dialog in `DemosTab` gets a "Block this day" / "Block a time range" action; red striping on blocked days in the month grid.

**Prompt** — append to the default Aria prompt:
> Before suggesting any demo time, call `get_available_slots`. Offer 2–3 of the returned slots only. When the prospect chooses one, call `book_demo_slot` and wait for `ok: true` before confirming verbally. If `ok: false`, apologise briefly and offer one of the other returned slots.

---

## Out of scope (ask later if needed)

- Google Calendar sync (can be added on top later without breaking this).
- Multi-user availability (this is super-admin only, for Mo).
- Self-service reschedule by the prospect.
