
## Goal

Make the data export GDPR-complete by doing two things:

1. **(A) Expand the business-side Excel** so business owners get a fuller operational record of their own data (not just 4 thin tabs).
2. **(B) Add a separate Data Subject Access Request (DSAR) flow** so a business can produce a per-customer archive for any individual end-customer who exercises their GDPR Article 15 right.

Both export as `.xlsx` (multi-tab) with the existing filename convention extended.

---

## 1. Expand business-side Excel export

**File:** `supabase/functions/export-business-data/index.ts`

Keep the existing 4 tabs and add these tabs (one row per record, business-scoped):

| Tab | Source table | Columns |
|---|---|---|
| Clients | `customers` | Name, Phone, Email, Total Visits, First Visit, Last Visit, Marketing Consent, Preferred Language, Notes/Preferences, How Heard, Blocked, Created At |
| Bookings | `bookings` (+ joins) | Booking Code, Client Name, Client Phone, Client Email, Service, Date, Time, End Time, Staff, Party Size, Status, Payment Status, Deposit Amount, Deposit Paid At, Order Total, Special Requests, Notes, Cancelled At, Created By, Created At |
| Call Logs | `calls_log` | Date, Time, Caller Name, Caller Number, To Number, Type, Outcome, Duration, Summary, Transcript, Tags, Booking Code (if linked), Recording URL, Created At |
| Messages | `messages` | Date, Time, Caller Name, Caller Phone, Content, Urgent, Read, Recipient |
| Orders | `orders` (+ `order_items`) | Order #, Date, Time, Customer Name, Phone, Type, Status, Items (joined string), Subtotal, Delivery Fee, Total, Payment Status, Notes |
| Fallback Reservations | `fallback_reservations` | Date, Time, Customer Name, Phone, Email, Party Size, Duration, Status, Special Requests, Allergens, Notes |
| Missed Calls | `missed_calls` | Date, Time, Caller Phone, Reason, Followed Up |
| Staff | `staff` (+ membership info) | Name, Role, Email, Phone, Position, Active |
| Services | `services` | Name, Duration, Price, Active |
| Business Profile | `businesses` + `business_settings` + `opening_hours` | Two-column key/value sheet: name, address, phones, website, type, currency, country, language, assistant settings, opening hours, policies |

Filename unchanged: `Aivia-Data-Export-<BusinessName>-<YYYY-MM-DD>.xlsx`.

Behaviour for multi-business owners: keep current pattern (one workbook, all tabs per business, sheet names suffixed with `— <BizTag>`).

---

## 2. New DSAR (per-customer) export

This is the **actual GDPR Article 15 deliverable**: everything we hold about ONE end-customer, identified by phone or email.

### 2a. Backend: new edge function `export-customer-data`

**File:** `supabase/functions/export-customer-data/index.ts` (new)

- Auth: business owner OR sub-admin with `can_view_analytics`.
- Input: `{ business_id, phone?, email?, customer_id? }` (at least one of phone/email/customer_id required).
- Resolve the customer record, then pull EVERYTHING tied to that phone/email/customer_id within the business:
  - `customers` row (full)
  - All `bookings` where `customer_phone = X` or `customer_email = Y` (full row + service name + staff name)
  - All `calls_log` where `caller_phone = X` (full row including `transcription`, `summary`, `recording_url`)
  - All `call_conversations` where `caller_phone = X` (including full `messages` JSONB)
  - All `messages` where `caller_phone = X`
  - All `orders` where `customer_phone = X` (+ `order_items`)
  - All `fallback_reservations` where `customer_phone = X` or `customer_email = Y`
  - All `missed_calls` where `caller_phone = X`
  - All `deposits`/payment records linked to those bookings
  - All `email_notifications`/`sms_notifications` sent to X/Y (if those tables exist — confirm during build)

Build a workbook with one tab per data type (skip empty tabs), plus a **"Summary"** tab listing: customer identity, data categories held, retention basis, business contact, export timestamp, and a plain-English notice explaining the customer's rights (rectification, erasure, portability, complaint to ICO).

Also include a **"Recordings & Transcripts"** tab with one row per call, columns: Date, Direction, Duration, Transcript, Signed Recording URL (24h-expiring signed URL from the `call-recordings` storage bucket).

**Filename:** `Aivia-DSAR-<BusinessName>-<CustomerNameOrPhone>-<YYYY-MM-DD>.xlsx` (sanitised).

### 2b. Frontend: new "Customer data request (GDPR)" UI

**File:** `src/components/dashboard/settings/CustomerDataRequestSection.tsx` (new)

A new card in the Settings → Account/GDPR section with:
- Heading: "Customer data request (DSAR)"
- Description: short paragraph explaining when to use this (when an end-customer requests their data under GDPR).
- Two inputs (phone OR email) and a "Generate report" button.
- On click: calls the new edge function, downloads the `.xlsx`.
- Shows error if no customer matched.

**File:** `src/components/dashboard/settings/AccountManagementSection.tsx`
- Tighten the existing card's helper text to clarify it's the **business-side** export, and add a one-line link/note pointing to the new DSAR card for customer requests.

---

## 3. Out of scope (call out, don't build)

- **Right to erasure (Article 17)**: not part of this task; a separate "delete a customer's data" flow would be needed for full GDPR.
- **Audit log of who requested what DSAR**: nice-to-have; can be added later as a `dsar_requests` table.
- **End-customer self-service portal**: customers currently request via the business; no public-facing DSAR page is built.
- **Encryption at rest of the .xlsx**: relies on HTTPS in transit + browser-side download; no password-protected zip.

---

## Technical notes

- DSAR function uses service-role client with explicit business-ownership check at the top (same pattern as existing export).
- Recording URLs: use `admin.storage.from("call-recordings").createSignedUrl(path, 86400)` per recording.
- Sheet name limit (31 chars): truncate business tag accordingly.
- All date/time formatting stays `en-GB` (DD/MM/YYYY, HH:mm) consistent with the existing export.
- No schema changes required.
- No new secrets required.

---

## Files touched

- Edit `supabase/functions/export-business-data/index.ts` (expanded tabs)
- Create `supabase/functions/export-customer-data/index.ts` (new DSAR function)
- Create `src/components/dashboard/settings/CustomerDataRequestSection.tsx`
- Edit `src/components/dashboard/settings/AccountManagementSection.tsx` (clarify copy + mount new card, or mount the new card in the parent settings page)
- Possibly edit the settings page that renders `AccountManagementSection` to also render `CustomerDataRequestSection` (confirmed during build)
