

# AIVIA Pre-Client Readiness Plan

Everything you need built NOW so restaurants can start using AIVIA immediately. This excludes OAuth flows, developer docs, sandbox environments, and API adapter patterns — those are only needed when you're ready to approach OpenTable, SevenRooms, etc.

---

## What This Plan Covers (7 Items)

### 1. Fallback Booking Mode
**What it is:** When a restaurant already uses OpenTable or another system, AIVIA captures the guest's details (name, party size, date, time, allergies, special requests) and sends an SMS + email to the restaurant saying "Please add this reservation to your system."

**Work involved:**
- New database table: `fallback_reservations` (guest name, phone, email, party size, date/time, special requests, status, business_id)
- New field on `businesses` table: `reservation_platform` (none / opentable / sevenrooms / resy / tock / other)
- New edge function: `create-fallback-reservation` — saves the data and triggers SMS/email to the restaurant owner
- Update the voice AI prompts to use this flow when the business has an external platform set
- Dashboard UI: new tab or section showing fallback reservations with status (pending / entered / confirmed)

### 2. Privacy Policy & Terms of Service Pages
**What it is:** Public-facing legal pages that any serious business needs. Covers how guest data is stored, GDPR compliance, and data handling.

**Work involved:**
- New route `/privacy` with a Privacy Policy page
- New route `/terms` with a Terms of Service page
- Footer links to both pages
- Content covering: data collection, storage, guest rights, GDPR, cookie policy

### 3. Missed-Call Alert System
**What it is:** If the AI fails to answer a call, or the caller hangs up before completion, the restaurant owner gets an SMS/email with the caller's number so they can call back.

**Work involved:**
- New database table: `missed_calls` (business_id, caller_phone, call_time, reason, notified, followed_up)
- New edge function: `notify-missed-call` — sends SMS + email to the business owner
- Update Twilio webhook handlers to detect failed/abandoned calls and trigger the alert
- Dashboard UI: missed calls list with "Mark as followed up" button

### 4. Structured Allergen Data on Menu Items
**What it is:** Right now the AI guesses about allergens from descriptions. This adds proper allergen fields so the AI can give accurate answers like "Yes, the pad thai contains peanuts."

**Work involved:**
- Add `allergens` column (text array) to `menu_items` table
- Add `ingredients` column (text) to `menu_items` table
- Update MenuManagement UI: allergen checkboxes (nuts, dairy, gluten, shellfish, eggs, soy, sesame, fish, celery, mustard, sulphites, lupin, molluscs)
- Update voice AI prompts to reference allergen data when answering dietary questions

### 5. Restaurant-Specific Onboarding Improvements
**What it is:** The onboarding already has restaurant steps, but needs polish for the "AI front desk" use case.

**Work involved:**
- Add a step asking "What reservation system do you currently use?" (None / OpenTable / SevenRooms / Resy / Tock / Other)
- Add a step for table layout setup (number of tables, sizes, indoor/outdoor)
- Add a prompt to upload menu or enter menu link
- Save the reservation platform choice to the `businesses` table

### 6. Demo/Sandbox Mode for Sales
**What it is:** A way to show potential restaurant clients what AIVIA looks like without creating a real account. A pre-built demo restaurant with fake data.

**Work involved:**
- New edge function: `setup-demo-restaurant` — creates a demo business with sample menu, tables, hours, and fake call history
- Demo mode flag on the dashboard that shows a banner "This is a demo — sign up to get started"
- Accessible via a special URL like `/demo/restaurant`

### 7. Restaurant Dashboard Polish
**What it is:** Making the existing dashboard work better for restaurants specifically.

**Work involved:**
- Reservation calendar view (table map with time slots)
- Today's reservations summary card on the dashboard tab
- Guest count and cover tracking (how many people served today/this week)
- Quick-action buttons: confirm reservation, mark as seated, mark as no-show

---

## Priority Order

| Order | Item | Why First |
|-------|------|-----------|
| 1 | Fallback Booking Mode | Lets you onboard ANY restaurant regardless of their current system |
| 2 | Missed-Call Alerts | Essential trust feature — restaurants need to know nothing falls through the cracks |
| 3 | Allergen Data | Food safety is non-negotiable for restaurants |
| 4 | Restaurant Onboarding | Smooth first impression for new clients |
| 5 | Privacy & Terms Pages | Professional credibility |
| 6 | Restaurant Dashboard Polish | Better daily experience for active clients |
| 7 | Demo/Sandbox Mode | Sales tool for getting more clients |

---

## Technical Summary

**New database tables:** 2 (fallback_reservations, missed_calls)

**Modified tables:** 2 (businesses — add reservation_platform; menu_items — add allergens + ingredients)

**New edge functions:** 3 (create-fallback-reservation, notify-missed-call, setup-demo-restaurant)

**Modified edge functions:** 2 (twilio voice webhooks for missed call detection, voice AI prompts for fallback flow)

**New pages/routes:** 4 (/privacy, /terms, /demo/restaurant, dashboard missed-calls section)

**Modified pages:** 3 (Onboarding, MenuManagement, Dashboard)

