# Aivia → Full Salon Platform: Implementation Plan

Three focused additions on top of what already exists. No landing-page rewrite in this pass.

---

## 1. Embeddable Booking Widget (floating button + iframe)

Goal: salon pastes one `<script>` tag into their site; a floating "Book Now" button appears bottom-right; clicking opens the existing public booking flow in a modal iframe.

### What we build
- **New embed-friendly route** `/embed/:slug` — same content as `PublicBookingPage` but with transparent background, no outer padding, and a `postMessage` handler so the iframe can tell the parent to close after a successful booking.
- **Public widget loader script** served from `/widget.js` (static file in `public/`). When the salon's site loads it, the script:
  - Reads the `data-slug` attribute on the script tag.
  - Injects a floating button (bottom-right, primary color, "Book Now" / "Order Now" based on business type fetched via a lightweight public endpoint).
  - On click, opens a full-screen modal containing `<iframe src="https://aiviaapp.co.uk/embed/{slug}">`.
  - Listens for `postMessage({ type: 'aivia:close' })` to dismiss.
- **Settings UI** — new "Website Widget" section inside `OnlineBookingSettings.tsx`:
  - Shows the snippet to copy: `<script src="https://aiviaapp.co.uk/widget.js" data-slug="{slug}" data-color="{hex}" async></script>`
  - Live preview button (opens `/embed/:slug` in a new tab).
  - Only shown when `online_booking_enabled = true`.
- **CORS / headers** — make sure `/embed/*` and `/widget.js` are servable cross-origin (update `public/_headers`).

### What we reuse
- Entire `PublicBookingPage` flow, staff/service selectors, cart, deposit Stripe path, customer form.
- Existing `booking_slug` and `online_booking_enabled` fields on `businesses`.

### Out of scope for v1
- Multiple widget styles (just the floating button).
- Custom positioning. (Always bottom-right.)
- Inline embed without floating button — can add later.

---

## 2. CSV Client Importer

Goal: salon switching from Fresha/Booksy uploads a CSV of their clients and they appear in Aivia's customer database.

### What we build
- **New dialog** `ImportCustomersDialog.tsx` accessible from `CustomersManagement.tsx`.
- Flow:
  1. Upload `.csv` (parse client-side with PapaParse — already a small dependency or add it).
  2. Preview first 5 rows + column mapper UI: map CSV columns → `name`, `phone`, `email`, `notes` (optional `total_visits`, `first_visit_date`).
  3. Validation: name required, phone or email required, dedupe against existing `customers` by phone within the business.
  4. Insert in batches via Supabase client; show progress + summary ("231 imported, 14 skipped as duplicates, 2 invalid").
- **Optional helper**: built-in templates for Fresha and Booksy export formats (auto-detect headers like "Client name", "Mobile", "Email").

### What we reuse
- Existing `customers` table (already has `business_id`, `name`, `phone`, `email`, `total_visits`, `first_visit_date`, `notes_preferences`).
- Existing RLS — business owners already have full access.

### Out of scope for v1
- Importing past appointments / appointment history.
- Importing gift vouchers, packages, loyalty.

---

## 3. Verify + Wire AI Phone Booking Confirmations

Goal: when the AI receptionist books an appointment, the customer gets an SMS and/or email confirmation if the business has those toggles on.

### What we do
- Audit the AI booking creation path (the edge function that handles tool calls from the OpenAI Realtime session) and confirm it:
  - Reads `businesses.sms_on_confirmation` and `businesses.email_on_confirmation`.
  - Calls the existing SMS sender (Twilio) and email sender (Resend) with the booking details.
- If wiring is missing or partial, add it. If it already fires, add a small "Test notifications" button in `EmailNotificationSettings.tsx` so the owner can verify.
- Confirm the same for cancellations and rescheduling done over the phone.

### What we reuse
- Existing toggles on `businesses` (`sms_on_confirmation`, `email_on_confirmation`, `sms_on_cancellation`, etc.).
- Existing Resend + Twilio integrations.

---

## Technical Notes

### Widget security & isolation
- `/embed/:slug` must work in an iframe → set `Content-Security-Policy: frame-ancestors *` (or omit X-Frame-Options) for that route only.
- The widget script must be tiny (~3KB) and have zero dependencies — vanilla JS, no React.
- Sanitize the `data-slug` attribute before injecting into iframe src.

### CSV import safety
- Hard cap upload at 5MB / 10,000 rows.
- Run inserts in batches of 500 to avoid timeouts.
- Always dedupe by (business_id, phone) — never create duplicate clients.

### Files touched / created
```text
NEW   public/widget.js                              vanilla JS loader (~80 lines)
NEW   src/pages/EmbedBookingPage.tsx                wraps PublicBookingPage in iframe-friendly shell
NEW   src/components/dashboard/settings/WidgetSnippet.tsx   copy/preview UI
NEW   src/components/dashboard/settings/ImportCustomersDialog.tsx
EDIT  src/components/dashboard/settings/OnlineBookingSettings.tsx   add Widget section
EDIT  src/components/dashboard/settings/CustomersManagement.tsx     add "Import CSV" button
EDIT  src/App.tsx                                                    add /embed/:slug route
EDIT  public/_headers                                                CORS + frame-ancestors for /embed and /widget.js
EDIT  supabase/functions/<ai-booking-handler>/index.ts               wire confirmation triggers if missing
```

### No database migrations required
All needed fields already exist on `businesses` and `customers`.

---

## Build order
1. Widget (route + loader + settings UI) — biggest user-visible win, ~1 day.
2. CSV importer — unlocks switching from Fresha, ~half day.
3. Audit + wire AI booking confirmations — ~half day.

Total: ~2 working days of focused build.
