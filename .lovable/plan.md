## Goal

Match Claude's spec for the landing-page demo: 5 industries, each with a specific business name, stat labels, dashboard list and a single "hero" after-hours call in the Calls tab that sells the value instantly. Drop the word "Demo" from every visible subtitle.

## Scope

Frontend only. Edits limited to:
- `src/components/landing/DemoDashboard.tsx`
- `src/lib/demoData.ts`

No backend, no signup, no real product dashboards.

## 1. Restaurants — collapse sub-toggle, rename to Zara's Kitchen

- Remove the 3-way Takeaway / Dine-in / Hybrid sub-toggle entirely. Restaurants becomes a single tab like the other four industries.
- Behaviour matches the existing "hybrid" path: both Orders and Reservations sections render together.
- Business name: `Zara's Kitchen`. Subtitle: `Restaurant`.
- Keep current orders + reservations lists largely as-is, but trim to a tighter set so the screen reads cleanly.
- Calls tab — replace the top entry with the hero call:
  - Time: `23:02` (Tue), duration `2m 41s`, status `Booked`.
  - Caller: `+44 7700 900318`.
  - Summary: `Late-night takeaway order taken after kitchen close — 1× Chicken Katsu, 1× Veg Gyoza, collection 11:45pm. Customer paid on collection.`
  - Outcome badge: `Order created · £24.50`.

## 2. Salon — Luxe Hair Studio

- Business name stays `Luxe Hair Studio`. Subtitle: `Hair Salon`.
- Stats row: `Appointments`, `Completed`, `Cancelled`, `Revenue`.
- Today's appointments list (replace current set):
  1. `10:00 — Hannah Roberts — Balayage — £150 — with Isla`
  2. `11:30 — Daniel Foster — Haircut & Beard — £45 — with Marcus`
  3. `13:00 — Priya Shah — Root Tint + Blow-dry — £85 — with Isla`
  4. `15:30 — Olivia Bennett — Cut & Style — £55 — with Marcus`
  5. `17:00 — Chloe Mitchell — Full Highlights — £180 — with Isla`
- Calls tab — three AI-handled bookings, hero entry on top:
  1. `20:47 Tue` — colour appt booked for Saturday after closing.
  2. `19:12 Mon` — reschedule + upsell to gloss treatment.
  3. `08:55 Sun` — new client, first cut booked next Thursday.
- Phone mockup mirrors the same appointments list (already does — keep parity).

## 3. Spa & Clinic — Serenity Aesthetics

- Rename business from `Serenity Spa & Clinic` to `Serenity Aesthetics`. Subtitle: `Aesthetics Clinic`.
- Stats row: `Consultations`, `Treatments`, `Cancelled`, `Revenue`.
- Today's treatments list:
  1. `10:00 — Emma Clarke — Hydrafacial — £150`
  2. `12:00 — Sophie Allen — Botox Consultation — £200`
  3. `14:00 — Rachel Owens — Lip Filler Top-up — £220`
  4. `15:30 — Megan Patel — Skin Peel — £130`
  5. `17:00 — Jasmine Lee — Microneedling — £190`
- Calls tab hero entry: `19:08 Wed` — new-patient enquiry, AI explains mandatory consultation policy, books consultation for Friday 11am.

## 4. Real Estate — Prime Property Group

- Rename `Marlow & Co. Estates` → `Prime Property Group`. Subtitle: `Estate Agency`.
- Stat labels change to: `Viewings Today`, `New Enquiries`, `Properties Available`, `Callbacks Pending` (requires extending `apptLabels` to drive all 4 stat tiles, not just the booking tile).
- Today's viewing schedule:
  1. `11:00 — James Peters — 24 Maple Street, 3-bed — £425,000`
  2. `14:00 — Sarah Hughes — Flat 12, Victoria Court — £1,200 pcm`
  3. `16:30 — Tom Whitaker — 8 Beechwood Avenue, 4-bed — £675,000`
  4. `18:00 — Lauren Ward — 5b Riverside Mews — £1,650 pcm`
- Calls tab hero entry: `Sat 09:14` — caller asks about listing, AI answers details from property record, captures contact, books Monday 17:30 viewing.

## 5. Trades — Swift Plumbing and Heating

- Rename `Pemberton Plumbing & Heating` → `Swift Plumbing and Heating`. Subtitle: `Plumbing & Heating`.
- Stat labels: `Jobs Today`, `Completed`, `Urgent Callbacks`, `Revenue`.
- Job list:
  1. `09:00 — Mrs Brown, 47 Oak Road — Boiler service — £120`
  2. `11:00 — Mr Ahmed — Emergency leak repair — £95`
  3. `13:30 — Ms Khan, 12 Elm Court — Radiator flush — £180`
  4. `15:30 — Mr Reilly — Bathroom tap replacement — £140`
  5. `17:00 — Mrs Davies — Thermostat fit — £85`
- Calls tab hero entry: `06:31 Thu` — emergency boiler breakdown, AI captures fault details + address, confirms engineer callback within the hour, sends SMS confirmation.

## 6. Drop the word "Demo" from subtitles

In `businessConfigs` (DemoDashboard.tsx) rewrite each `subtitle` to remove `Demo`:

| key | new subtitle |
|---|---|
| restaurants | `Restaurant` |
| salon | `Hair Salon` |
| spa | `Aesthetics Clinic` |
| realestate | `Estate Agency` |
| trades | `Plumbing & Heating` |

(The internal Takeaway / Dine-in / Hybrid config entries are dropped along with the sub-toggle.)

## Technical notes

- Collapse `EffectiveType` back to the same 5-value union as `DemoBusinessType`. Delete `RestaurantSubType`, `restaurantSub` state, the sub-toggle JSX, and any `effectiveType === "takeaway" | "dinein" | "hybrid"` branches — replace with a single `effectiveType === "restaurants"` branch that always shows both Orders and Reservations.
- Extend `apptLabels` to cover all 4 stat-tile labels per industry (today / completed / cancelled-or-callbacks / revenue-or-pipeline) instead of just the bookings tile, so Real Estate and Trades can show their bespoke labels without bleeding into other industries.
- In `demoData.ts` rewrite (in place, not new exports):
  - `DEMO_TODAYS_APPOINTMENTS` → Luxe Hair Studio list above.
  - `DEMO_SPA_APPOINTMENTS` → Serenity Aesthetics list.
  - `DEMO_REALESTATE_APPOINTMENTS` → Prime Property Group list.
  - `DEMO_TRADES_APPOINTMENTS` → Swift Plumbing list.
  - `DEMO_ORDERS` / `DEMO_RESERVATIONS` → trim to Zara's Kitchen names.
  - Each `*_CALLS` array: replace top entry with the hero call described above and adjust 2-3 surrounding entries for context.
  - Each `*_STATS` object: update totals so they match the new appointment counts and revenue.
- Keep both phone mockups reading from `statView` so labels propagate for free.
- No changes to `src/lib/tiers.ts`, signup, real dashboards, or the `business_type` enum.

## Out of scope

- No new industries.
- No new icons beyond what is already imported.
- No localisation, animation or layout overhaul of the demo shell.
- No changes to the real product, only the landing-page demo.
