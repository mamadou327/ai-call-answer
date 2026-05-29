## Goal

Extend the landing-page demo dashboard (the pill selector currently showing Takeaway / Dine-in / Hybrid) with two new appointment-based variants:

- **Salon** — appointments, staff, services (matches the Salons & Barbershops product tier)
- **Spa / Wellness** — treatments, rooms, longer durations

Both at the same depth as the Hybrid demo: stats, today's appointments list, calls, messages, and the phone mockup — fully clickable.

## Scope

Frontend / demo content only. No DB, no edge functions, no real product behavior changes.

## Files to change

1. **`src/lib/demoData.ts`** — add new demo datasets:
   - `DEMO_SALON_APPOINTMENTS` (~8 today, mix of statuses: confirmed / in-progress / completed / cancelled)
   - `DEMO_SALON_STAFF` (3–4 stylists with chair assignments)
   - `DEMO_SALON_SERVICES` (haircut, colour, blow-dry, beard trim, etc. with durations + prices)
   - `DEMO_SALON_STATS` (appointments today, completed, cancelled, revenue)
   - `DEMO_SALON_CALLS` + `DEMO_SALON_MESSAGES` (booking-flavoured, not order-flavoured)
   - Same set for Spa: `DEMO_SPA_APPOINTMENTS`, `DEMO_SPA_STAFF` (therapists + rooms), `DEMO_SPA_SERVICES` (massage 60/90 min, facial, body wrap), `DEMO_SPA_STATS`, `DEMO_SPA_CALLS`, `DEMO_SPA_MESSAGES`

2. **`src/components/landing/DemoDashboard.tsx`** — extend the selector + dashboard:
   - Widen `RestaurantType` → `DemoBusinessType = "takeaway" | "dinein" | "hybrid" | "salon" | "spa"`
   - Add two pill buttons (Scissors icon for Salon, Sparkles icon for Spa) — selector becomes 5 options; on mobile let it wrap or scroll-x so it doesn't overflow
   - Add `businessConfigs` entries: Salon → "Luxe Hair Studio / Salon Demo", Spa → "Serenity Spa / Spa & Wellness Demo"
   - When `salon` or `spa` is selected:
     - Hide Orders + Reservations sections
     - Show new **Today's Appointments** kanban (Upcoming / In Chair / Completed / Cancelled) reusing the existing card/grid styling
     - Show **Staff schedule** strip (chair/room → next 2 appointments)
     - Stats cards relabel: "Appointments / Completed / Cancelled / Revenue"
     - Calls + Messages tabs use the salon/spa demo data (booking, reschedule, enquiry types)
   - Phone mockup mirrors the same data with appointment cards instead of order cards

3. **`src/components/landing/HeroSection.tsx`** (or wherever DemoDashboard is mounted) — no change expected; selector lives inside DemoDashboard.

## Out of scope

- No changes to `BusinessTypeSelector.tsx` on the landing page (that's the "Built for Your Industry" section, separate from the demo).
- No new business_type values in the DB or product — these are purely visual demos for marketing.
- No Barbershop demo (would be near-identical to Salon).
- No localisation copy beyond English.

## Acceptance

- Pill selector shows 5 options on desktop; wraps/scrolls cleanly at the current preview width.
- Clicking Salon or Spa swaps the business name, subtitle, stats, appointments, calls, and messages.
- Phone mockup updates with the same data.
- Existing Takeaway / Dine-in / Hybrid demos behave unchanged.
