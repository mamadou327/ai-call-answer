## Goal

Reshape the landing-page demo selector to 6 industry pills, all at full Salon/Spa depth (stats, today's list, calls, messages, phone mockup):

1. **Restaurants** — single pill with an inner sub-toggle for Takeaway / Dine-in / Hybrid
2. **Salons**
3. **Spa**
4. **Clinic**
5. **Real Estate**
6. **Trades**

Frontend/demo-only. No DB changes, no new product business types, no signup or dashboard changes.

## Important note on "looks like they signed up"

The real product today only ships dashboards for **restaurants (takeaway / dine-in / hybrid)** and **salons/spa** (appointment model). There is no built clinic, real-estate, or trades dashboard.

For the new three I will mirror the **salon/appointment dashboard pattern** (which is what those businesses would actually be onboarded onto today — appointment-led), and just relabel terminology so it reads native to each industry. This keeps the demo honest: what they see in the demo is what they'd see after signup, with industry-specific labels.

| Industry | Mirrors | Relabels |
|---|---|---|
| Clinic | Salon dashboard | "Appointments" → "Patient appointments", staff → "Practitioners", services → "Consultations/Treatments", rooms → "Consult rooms" |
| Real Estate | Salon dashboard | "Appointments" → "Viewings", staff → "Agents", services → "Property viewings / valuations", revenue → "Pipeline £" |
| Trades | Salon dashboard | "Appointments" → "Jobs", staff → "Engineers", services → "Call-outs / Quotes / Repairs", revenue → "Day takings" |

## Files to change

### 1. `src/lib/demoData.ts`
Add six new demo datasets (each: appointments list ~8 items, staff 3–4, services 4–6, stats, calls ~5, messages ~5):

- `DEMO_CLINIC_*` — GP/dental flavour: "Check-up", "Filling", "Cleaning", patient names, practitioner staff
- `DEMO_REALESTATE_*` — viewings & valuations: "2-bed flat viewing — 14 Oak Ave", agent staff, enquiry calls about listings
- `DEMO_TRADES_*` — plumber/electrician flavour: "Boiler service", "Emergency call-out", engineer staff, day-rate revenue

Keep existing `DEMO_ORDERS`, `DEMO_RESERVATIONS`, salon/spa datasets untouched.

### 2. `src/components/landing/DemoDashboard.tsx`
- Widen type:
  ```ts
  type DemoBusinessType = "restaurants" | "salon" | "spa" | "clinic" | "realestate" | "trades";
  type RestaurantSubType = "takeaway" | "dinein" | "hybrid";
  ```
- Replace the 3 restaurant pills with one **Restaurants** pill (UtensilsCrossed icon). Add Clinic (Stethoscope), Real Estate (Home), Trades (Wrench) pills. Total = 6 pills; mobile uses horizontal scroll-x.
- When `restaurants` is selected, show a **secondary segmented toggle** (Takeaway / Dine-in / Hybrid) above the dashboard body. Internally this drives the existing takeaway/dinein/hybrid branches verbatim — no behaviour change to the restaurant demo.
- Extend `businessConfigs` with entries for clinic / realestate / trades (business name, subtitle, currency, icon, accent colour).
- Generalise the existing `statView` builder so it accepts per-type labels for primary/secondary/cancelled/last-value, then feed each new industry its own labels. Reuse:
  - Stats grid (4 cards)
  - "Today's Appointments" kanban (Upcoming / In progress / Completed / Cancelled) — relabelled per industry ("Today's Viewings", "Today's Jobs", "Today's Patients")
  - Staff strip (relabelled "Agents" / "Engineers" / "Practitioners")
  - Calls + Messages tabs using the new datasets
  - Both phone mockups (inline and floating) — they already read from `statView`, so they pick up the new labels for free
- Hide Orders + Reservations sections for the four appointment-based industries (same rule as salon/spa today).

### 3. `.lovable/plan.md`
Append a short "v2 — 6 industries + restaurant sub-toggle" section so future context reflects the new layout.

## Out of scope

- No new `business_type` enum values in Supabase, no signup flow changes, no real dashboard for clinic/realestate/trades.
- No `BusinessTypeSelector.tsx` (the "Built for Your Industry" cards) change in this pass — can do as a follow-up if you want it to mirror the same 6.
- No localisation beyond English.
- No new icons beyond `lucide-react` (Stethoscope, Home, Wrench).

## Acceptance

- Selector shows 6 pills; on the current ~1113px viewport they fit on one row, on mobile they scroll horizontally without overflow.
- Clicking Restaurants reveals an inner Takeaway/Dine-in/Hybrid sub-toggle; switching it swaps the dashboard exactly as the current 3 pills do today.
- Clicking Clinic / Real Estate / Trades swaps business name, subtitle, stats labels, appointment kanban, staff strip, calls, messages, and both phone mockups to that industry's data.
- Salon and Spa demos are unchanged.

---

## v2 — 5 industries (current state)

Selector reduced to 5 pills:
- **Restaurants** (single pill) with an inner segmented sub-toggle for Takeaway / Dine-in / Hybrid
- **Salons**
- **Spa & Clinics** (reuses spa demo data; pill renamed only)
- **Real Estate** (new — `DEMO_REALESTATE_*`, viewings/agents/pipeline labels)
- **Trades** (new — `DEMO_TRADES_*`, jobs/engineers/day-takings labels)

Internally `selectedType` is one of the 5 + a `restaurantSub` state. All downstream data branching uses an `effectiveType` alias that expands `restaurants` → the selected sub-type, so existing takeaway/dinein/hybrid behaviour is preserved verbatim.

Industry-specific labels live in an `apptLabels` object (primary stat, list title, revenue label, call-stats label). Real Estate shows "Viewings / Pipeline", Trades shows "Jobs / Day Takings".
